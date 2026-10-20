from datetime import datetime, timedelta

import pytest
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from models import Base, Forløb, Opgave
from controllers import mail_controller

USER_EMAIL = "user@example.com"
ANSVARLIG_A = "a@example.com"
ANSVARLIG_B = "b@example.com"


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


def _midnight(days_from_today: int) -> datetime:
    return datetime.combine(datetime.now().date() + timedelta(days=days_from_today), datetime.min.time())


def _seed(db, tasks: list[dict]) -> list[int]:
    session = db.get_session()
    forloeb = Forløb(name="Test Person", admin="admin@example.com", usermail=USER_EMAIL, userdq="DQ1")
    session.add(forloeb)
    session.flush()
    opgaver = [
        Opgave(
            title="Task",
            beskrivelse="b",
            ansvarlig="Ansvarlig",
            ansvarligEmail=t.get("ansvarligEmail", ANSVARLIG_A),
            result=t.get("result", False),
            timestamp=datetime.now(),
            startdato=t["startdato"],
            ForløbID=forloeb.ForløbID,
        )
        for t in tasks
    ]
    session.add_all(opgaver)
    session.commit()
    ids = [o.OpgaveID for o in opgaver]
    session.close()
    return ids


def _run():
    app = Flask(__name__)
    with app.app_context():
        resp, status = mail_controller.notify_upcoming_tasks_aggregated()
        return resp.get_json(), status


def test_only_tasks_starting_tomorrow_are_included(db, sent):
    ids = _seed(
        db,
        [
            {"startdato": _midnight(1)},  # tomorrow 00:00 -> included
            {"startdato": _midnight(2) - timedelta(minutes=1)},  # tomorrow 23:59 -> included
            {"startdato": _midnight(1) - timedelta(minutes=1)},  # today 23:59 -> excluded
            {"startdato": _midnight(2)},  # day after tomorrow -> excluded
            {"startdato": _midnight(1) + timedelta(hours=8), "result": True},  # completed -> excluded
        ],
    )

    data, status = _run()

    assert status == 200
    assert data["upcoming_task_count"] == 2
    assert len(sent) == 1
    body = sent[0]["body"]
    assert f"item={ids[0]}" in body and f"item={ids[1]}" in body
    for excluded in ids[2:]:
        assert f"item={excluded}" not in body


def test_only_ansvarlig_is_notified_and_mails_are_aggregated_per_ansvarlig(db, sent):
    _seed(
        db,
        [
            {"startdato": _midnight(1) + timedelta(hours=9), "ansvarligEmail": ANSVARLIG_A},
            {"startdato": _midnight(1) + timedelta(hours=10), "ansvarligEmail": " A@Example.com "},
            {"startdato": _midnight(1) + timedelta(hours=11), "ansvarligEmail": ANSVARLIG_B},
        ],
    )

    data, status = _run()

    assert status == 200
    assert sorted(c["recipient"] for c in sent) == [ANSVARLIG_A, ANSVARLIG_B]
    assert USER_EMAIL not in [c["recipient"] for c in sent]
    assert data["sent_ansvarlig"] == 2


def test_no_upcoming_tasks(db, sent):
    _seed(db, [{"startdato": _midnight(5)}])

    data, status = _run()

    assert status == 200
    assert data["message"] == "No upcoming tasks to notify"
    assert sent == []
