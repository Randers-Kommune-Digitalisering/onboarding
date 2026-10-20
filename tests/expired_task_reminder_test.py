from datetime import datetime, timedelta

import pytest
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from models import Base, Forløb, Mail, Opgave
from controllers import mail_controller
from utils.config import (
    MAIL_DESC_EXPIRED_TASK_ANSVARLIG,
    MAIL_DESC_EXPIRED_TASK_USER,
    MAIL_DESC_NEW_TASK_USER,
)

USER_EMAIL = "user@example.com"
ANSVARLIG_EMAIL = "ansvarlig@example.com"


class _TestDbClient:
    def __init__(self, engine):
        self.engine = engine

    def get_session(self):
        return Session(self.engine)


@pytest.fixture()
def db(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    client = _TestDbClient(engine)
    monkeypatch.setattr(mail_controller, "db_client", client)
    return client


@pytest.fixture()
def sent(monkeypatch):
    calls = []

    def _fake_send_mail(recipient, subject, body, attachments=None, reply_to=None):
        calls.append({"recipient": recipient, "body": body})
        return True

    monkeypatch.setattr(mail_controller, "send_mail", _fake_send_mail)
    return calls


def _seed_expired_task(db) -> int:
    session = db.get_session()
    forloeb = Forløb(name="Test Person", admin="admin@example.com", usermail=USER_EMAIL, userdq="DQ1")
    session.add(forloeb)
    session.flush()
    opgave = Opgave(
        title="Expired task",
        beskrivelse="b",
        ansvarlig="Ansvarlig",
        ansvarligEmail=ANSVARLIG_EMAIL,
        result=False,
        timestamp=datetime.now(),
        slutdato=datetime.now() - timedelta(days=10),
        ForløbID=forloeb.ForløbID,
    )
    session.add(opgave)
    session.commit()
    opgave_id = opgave.OpgaveID
    session.close()
    return opgave_id


def _add_sent_mail(db, opgave_id: int, recipient: str, description: str, sent_at: datetime):
    session = db.get_session()
    session.add(
        Mail(
            created=sent_at,
            subject="s",
            body="b",
            recipient=recipient,
            isSent=True,
            sent=sent_at,
            OpgaveID=opgave_id,
            description=description,
        )
    )
    session.commit()
    session.close()


def _run():
    app = Flask(__name__)
    with app.app_context():
        resp, status = mail_controller.notify_expired_tasks_aggregated()
        return resp.get_json(), status


def _recipients(calls):
    return sorted(c["recipient"] for c in calls)


def test_first_run_notifies_both_and_records_reminders(db, sent):
    opgave_id = _seed_expired_task(db)

    data, status = _run()

    assert status == 200
    assert _recipients(sent) == [ANSVARLIG_EMAIL, USER_EMAIL]
    assert data["sent_user"] == 1 and data["sent_ansvarlig"] == 1

    session = db.get_session()
    rows = session.query(Mail).filter_by(OpgaveID=opgave_id).all()
    assert sorted((r.recipient, r.description) for r in rows) == [
        (ANSVARLIG_EMAIL, MAIL_DESC_EXPIRED_TASK_ANSVARLIG),
        (USER_EMAIL, MAIL_DESC_EXPIRED_TASK_USER),
    ]
    assert all(r.isSent and r.sent is not None for r in rows)
    session.close()


def test_second_run_within_interval_sends_nothing(db, sent):
    _seed_expired_task(db)
    _run()
    sent.clear()

    data, status = _run()

    assert status == 200
    assert sent == []
    assert data["skipped_user_recently_notified"] == 1
    assert data["skipped_ansvarlig_recently_notified"] == 1


def test_cooldown_is_per_recipient(db, sent):
    opgave_id = _seed_expired_task(db)
    # Recipient case differences must not bypass the cooldown.
    _add_sent_mail(db, opgave_id, "User@Example.com", MAIL_DESC_EXPIRED_TASK_USER, datetime.now() - timedelta(days=1))

    _run()

    assert _recipients(sent) == [ANSVARLIG_EMAIL]


def test_reminder_resent_after_interval(db, sent):
    opgave_id = _seed_expired_task(db)
    long_ago = datetime.now() - timedelta(days=3, minutes=1)
    _add_sent_mail(db, opgave_id, USER_EMAIL, MAIL_DESC_EXPIRED_TASK_USER, long_ago)
    _add_sent_mail(db, opgave_id, ANSVARLIG_EMAIL, MAIL_DESC_EXPIRED_TASK_ANSVARLIG, long_ago)

    _run()

    assert _recipients(sent) == [ANSVARLIG_EMAIL, USER_EMAIL]


def test_other_mail_types_do_not_block_reminder(db, sent):
    opgave_id = _seed_expired_task(db)
    _add_sent_mail(db, opgave_id, USER_EMAIL, MAIL_DESC_NEW_TASK_USER, datetime.now() - timedelta(hours=1))

    _run()

    assert _recipients(sent) == [ANSVARLIG_EMAIL, USER_EMAIL]


def test_only_recently_notified_tasks_are_excluded_from_aggregate(db, sent):
    first_id = _seed_expired_task(db)
    second_id = _seed_expired_task(db)
    _add_sent_mail(db, first_id, ANSVARLIG_EMAIL, MAIL_DESC_EXPIRED_TASK_ANSVARLIG, datetime.now() - timedelta(days=1))

    _run()

    ansvarlig_bodies = [c["body"] for c in sent if c["recipient"] == ANSVARLIG_EMAIL]
    assert len(ansvarlig_bodies) == 1
    assert f"item={second_id}" in ansvarlig_bodies[0]
    assert f"item={first_id}" not in ansvarlig_bodies[0]


def test_reminder_rows_are_committed_once(db, sent, monkeypatch):
    _seed_expired_task(db)
    _seed_expired_task(db)
    commits = []
    original_get_session = db.get_session

    def _counting_session():
        session = original_get_session()
        original_commit = session.commit

        def _commit():
            commits.append(1)
            original_commit()

        session.commit = _commit
        return session

    monkeypatch.setattr(db, "get_session", _counting_session)

    data, status = _run()

    assert status == 200
    assert data["reminders_recorded"] is True
    assert len(sent) == 3  # one per forløb user + one aggregated to the shared ansvarlig
    assert len(commits) == 1


def test_sent_reminders_are_recorded_even_if_run_fails(db, monkeypatch):
    opgave_id = _seed_expired_task(db)

    def _send_mail(recipient, subject, body, attachments=None, reply_to=None):
        if recipient == ANSVARLIG_EMAIL:
            raise RuntimeError("boom")
        return True

    monkeypatch.setattr(mail_controller, "send_mail", _send_mail)

    _, status = _run()

    assert status == 500
    session = db.get_session()
    rows = session.query(Mail).filter_by(OpgaveID=opgave_id).all()
    assert [(r.recipient, r.description) for r in rows] == [(USER_EMAIL, MAIL_DESC_EXPIRED_TASK_USER)]
    session.close()
