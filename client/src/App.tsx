import { Routes, Route, Navigate } from 'react-router-dom'
import ComponentTest from './pages/ComponentTest'

// Placeholder pages - will be implemented in later phases
function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
      <div className="text-center">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Classroom System</h1>
        <p className="text-sm text-gray-500">Phase 3-5에서 구현 예정</p>
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
      <div className="text-center">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Dashboard</h1>
        <p className="text-sm text-gray-500">Phase 3-6에서 구현 예정</p>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
      <div className="text-center">
        <h1 className="text-4xl font-medium text-gray-900 mb-2">404</h1>
        <p className="text-sm text-gray-500">페이지를 찾을 수 없습니다</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/test/components" element={<ComponentTest />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
