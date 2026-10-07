import './assets/main.css'

import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from './App.vue'

import { getUserInfo } from './services/keycloakService.js'
import { installTooltipHelper } from './utils/tooltipHelper.js'
import { openCourses, MAX_OPEN_COURSES, isCourseRoute, isExternalRoute, resolveCourseRef } from './stores/openCourses.js'

// Import af views til routing
import CreateOpgave from '@/views/admin/CreateOpgave.vue'
import CreateForløb from '@/views/admin/CreateForløb.vue'
import EditForløb from '@/views/admin/EditForløb.vue'
import StartForløb from '@/views/admin/StartForløb.vue'
import CreateRessource from '@/views/admin/CreateRessource.vue'
import CreateForløbsskabelon from '@/views/admin/CreateForløbsskabelon.vue'
import AdminOverview from '@/views/admin/AdminOverview.vue'
import MedarbejderOverview from '@/views/ny_medarbejder/MedarbejderOverview.vue'
import AnsvarligOverview from '@/views/ansvarlig/AnsvarligOverview.vue'
import AdminHelp from '@/views/admin/AdminHelp.vue'
import Help from '@/views/Help.vue'
import CourseWorkspace from '@/views/CourseWorkspace.vue'
import TemplateOverview from '@/views/admin/TemplateOverview.vue'
import Login from '@/views/Login.vue'
import SendWelcome from './views/admin/SendWelcome.vue'

// Define routes
const routes = [ 
    {
        path: '/create-opgave',
        name: 'CreateOpgave',
        component: CreateOpgave,
        beforeEnter: (to) => {
            if (to.query.template === 'true' || to.query.tid)
                return true

            return {
                path: '/forloeb-overview/create-opgave',
                query: to.query,
            }
        },
        meta: { roles: ['Admin'], formPage: true }
    },
    {
        path: '/create-forloeb',
        name: 'CreateForløb',
        component: CreateForløb,
        meta: { roles: ['Admin'], formPage: true }
    },
    {
        path: '/edit-forloeb',
        name: 'EditForløb',
        redirect: (to) => ({
            path: '/forloeb-overview/edit-forloeb',
            query: to.query,
        }),
        meta: { roles: ['Admin'] }
    },
    {
        path: '/start-forloeb',
        name: 'StartForløb',
        redirect: (to) => ({
            path: '/forloeb-overview/start-forloeb',
            query: to.query,
        }),
        meta: { roles: ['Admin'] }
    },
    {
        path: '/create-ressource',
        name: 'CreateRessource',
        component: CreateRessource,
        beforeEnter: (to) => {
            if (to.query.tid)
                return true

            return {
                path: '/forloeb-overview/create-ressource',
                query: to.query,
            }
        },
        meta: { roles: ['Admin', 'Medarbejder'], formPage: true }
    },
    {
        path: '/create-forloebsskabelon',
        name: 'CreateForløbsskabelon',
        component: CreateForløbsskabelon,
        beforeEnter: (to) => {
            // Keep standalone create flow from template-overview.
            // Redirect edit/context-bound flows to nested forloeb-overview route.
            if (to.query.edit !== 'true' && !to.query.id && !to.query.tid)
                return true

            return {
                path: '/forloeb-overview/create-forloebsskabelon',
                query: to.query,
            }
        },
        meta: { roles: ['Admin'], formPage: true }
    },
    {
        path: '/send-velkomst',
        name: 'SendVelkomst',
        redirect: (to) => ({
            path: '/forloeb-overview/send-velkomst',
            query: to.query,
        }),
        meta: { roles: ['Admin'] }
    },
    {
        path: '/admin-overview',
        name: 'AdminOverview',
        component: AdminOverview,
        meta: { roles: ['Admin'] }
    },
    {
        path: '/ansvarlig-overview',
        name: 'AnsvarligOverview',
        component: AnsvarligOverview,
        meta: { roles: ['Admin', 'Medarbejder'] }
    },
    {
        path: '/help',
        name: 'Help',
        component: Help,
        meta: { roles: ['Medarbejder'] }
    },
    {
        path: '/admin-help',
        name: 'AdminHelp',
        component: AdminHelp,
        meta: { roles: ['Admin'] }
    },
    {
        path: '/template-overview',
        name: 'TemplateOverview',
        component: TemplateOverview,
        meta: { roles: ['Admin'] }
    },
    {
        path: '/medarbejder-overview',
        name: 'MedarbejderOverview',
        component: MedarbejderOverview,
        meta: { roles: ['Medarbejder'] }
    },
    {
        path: '/forloeb-overview',
        component: CourseWorkspace,
        children: [
            {
                path: 'edit-forloeb',
                name: 'ForløbOverviewEditForløb',
                component: EditForløb,
                meta: { roles: ['Admin'] }
            },
            {
                path: 'create-opgave',
                name: 'ForløbOverviewCreateOpgave',
                component: CreateOpgave,
                meta: { roles: ['Admin'] }
            },
            {
                path: 'create-ressource',
                name: 'ForløbOverviewCreateRessource',
                component: CreateRessource,
                meta: { roles: ['Admin', 'Medarbejder'] }
            },
            {
                path: 'send-velkomst',
                name: 'ForløbOverviewSendVelkomst',
                component: SendWelcome,
                meta: { roles: ['Admin'] }
            },
            {
                path: 'start-forloeb',
                name: 'ForløbOverviewStartForløb',
                component: StartForløb,
                meta: { roles: ['Admin'] }
            },
            {
                path: 'create-forloebsskabelon',
                name: 'ForløbOverviewCreateForløbsskabelon',
                component: CreateForløbsskabelon,
                meta: { roles: ['Admin'] }
            }
        ],
        meta: { roles: ['Admin', 'Medarbejder', 'Public'] }
    },
    {
        path: '/login',
        name: 'Login',
        component: Login,
        meta: { hideNavbar: true }
    },
    {
        path: '/auth',
        meta: { hideNavbar: true }
    }
]

// Opsætning af URL routing
const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition)
            return savedPosition
        // Course tabs restore their own scroll position when switched to
        if (isCourseRoute(to) || to.path === from.path)
            return false
        return { top: 0 }
    }
})

const app = createApp(App)
app.use(router)

const uninstallTooltipHelper = installTooltipHelper()

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        uninstallTooltipHelper()
    })
}

const currentPath = window.location.pathname
const currentRoute = window.location.pathname + window.location.search
router.addRoute({ path: currentRoute })

router.beforeEach((to, from, next) => {
    if(to.path === '/login')
        next()
    
    else
        getUserInfo().then(userInfo => {
            let userRoles = userInfo.roles

            if (to.matched.some(record => record.meta.roles)) {
                const requiredRoles = to.meta.roles
                const hasAccess = requiredRoles.some(role => userRoles.includes(role))

                if (!hasAccess) {
                    // User does not have access to requested route
                    returnRoleBasedUrl(userInfo).then(url => {
                        next(url)
                    })
                    
                } else {
                    next()
                }
            } else {
                returnRoleBasedUrl(userInfo).then(url => {
                    next(url)
                })
            }
        }).catch(() => {
            next({ path: '/login' })
        })
})

const returnRoleBasedUrl = async (_userInfo = null) => {
    try {
        const userInfo = _userInfo ?? await getUserInfo()
        let userRoles = userInfo.roles

        if (userRoles.includes('Admin'))
            return '/admin-overview'
        else if (userRoles.includes('Medarbejder'))
            return '/medarbejder-overview'
        else
            return '/login'
        
    } catch {
        return '/login'
    }
}

if (currentPath === '/')
    returnRoleBasedUrl().then(url => {
        router.push(url)
    })

// Runs after the role guard above: course routes need a course id and respect the open-tab cap
router.beforeEach(async (to, from) => {
    if (!isCourseRoute(to))
        return true

    const courseRef = resolveCourseRef(to.query)
    if (!courseRef)
        return returnRoleBasedUrl()

    if (isExternalRoute(to) || openCourses.canOpen(courseRef.key))
        return true

    openCourses.showNotice(`Du kan højst have ${MAX_OPEN_COURSES} forløb åbne. Luk et forløb for at åbne et nyt.`)
    return from.matched.length > 0 ? false : returnRoleBasedUrl()
})

router.afterEach((to, from, failure) => {
    if (failure || !isCourseRoute(to) || isExternalRoute(to))
        return

    const courseRef = resolveCourseRef(to.query)
    if (courseRef)
        openCourses.open(courseRef, to)
})

if (!isExternalRoute(router.resolve(currentRoute)))
    openCourses.restore(router)

app.mount('#app')