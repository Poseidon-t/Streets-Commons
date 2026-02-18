import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import ReportView from './components/ReportView.tsx'
import AdvocacyProposalView from './components/AdvocacyProposalView.tsx'
import CityPage from './components/CityPage.tsx'
import CityIndex from './components/CityIndex.tsx'
import BlogIndex from './components/BlogIndex.tsx'
import BlogPost from './components/BlogPost.tsx'
import LearnIndex from './components/LearnIndex.tsx'
// Reports
import { FifteenMinuteCityReport } from './components/reports'

// Enterprise marketing pages (lazy-loaded)
const EnterpriseLayout = lazy(() => import('./enterprise/EnterpriseLayout'))
const EnterpriseHome = lazy(() => import('./enterprise/EnterpriseHome'))
const ForGovernments = lazy(() => import('./enterprise/ForGovernments'))
const ForRealEstate = lazy(() => import('./enterprise/ForRealEstate'))
const ForMobility = lazy(() => import('./enterprise/ForMobility'))
const ForResearch = lazy(() => import('./enterprise/ForResearch'))
const HowItWorks = lazy(() => import('./enterprise/HowItWorks'))
const EnterpriseMetrics = lazy(() => import('./enterprise/Metrics'))
const EnterprisePricing = lazy(() => import('./enterprise/Pricing'))
const EnterpriseContact = lazy(() => import('./enterprise/Contact'))

// Admin panel (lazy-loaded, code-split)
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))
const BlogManager = lazy(() => import('./admin/BlogManager'))
const BlogEditor = lazy(() => import('./admin/BlogEditor'))
const ContentQueue = lazy(() => import('./admin/ContentQueue'))
const EmailCaptures = lazy(() => import('./admin/EmailCaptures'))

// Import Clerk publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key. Add VITE_CLERK_PUBLISHABLE_KEY to your .env file.')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInFallbackRedirectUrl={window.location.href}
      signUpFallbackRedirectUrl={window.location.href}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/report" element={<ReportView />} />
          <Route path="/proposal" element={<AdvocacyProposalView />} />
          {/* Programmatic SEO city pages */}
          <Route path="/walkability" element={<CityIndex />} />
          <Route path="/walkability/:citySlug" element={<CityPage />} />
          {/* Blog */}
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:postSlug" element={<BlogPost />} />
          {/* Learn — educational resources */}
          <Route path="/learn" element={<LearnIndex />} />
          {/* Reports */}
          <Route path="/report/15-minute-city" element={<FifteenMinuteCityReport />} />
          {/* Enterprise marketing pages */}
          <Route path="/enterprise" element={
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><div className="text-gray-400">Loading...</div></div>}>
              <EnterpriseLayout />
            </Suspense>
          }>
            <Route index element={<EnterpriseHome />} />
            <Route path="governments" element={<ForGovernments />} />
            <Route path="real-estate" element={<ForRealEstate />} />
            <Route path="mobility" element={<ForMobility />} />
            <Route path="research" element={<ForResearch />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="metrics" element={<EnterpriseMetrics />} />
            <Route path="pricing" element={<EnterprisePricing />} />
            <Route path="contact" element={<EnterpriseContact />} />
          </Route>
          {/* Admin panel */}
          <Route path="/admin" element={
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-400">Loading admin...</div></div>}>
              <AdminLayout />
            </Suspense>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="content-queue" element={<ContentQueue />} />
            <Route path="blog" element={<BlogManager />} />
            <Route path="blog/new" element={<BlogEditor />} />
            <Route path="blog/edit/:slug" element={<BlogEditor />} />
            <Route path="emails" element={<EmailCaptures />} />
          </Route>
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
              <div className="text-center px-6">
                <h1 className="text-6xl font-bold mb-4" style={{ color: '#2a3a2a' }}>404</h1>
                <p className="text-xl mb-6" style={{ color: '#5a6a5a' }}>Page not found</p>
                <a href="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg" style={{ backgroundColor: '#e07850' }}>
                  Go to SafeStreets
                </a>
              </div>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)
