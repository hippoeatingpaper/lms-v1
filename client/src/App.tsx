import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { AuthGuard, GuestGuard } from './components/AuthGuard'
import { TeacherLayout } from './layouts/TeacherLayout'
import { StudentLayout, StudentProfile } from './layouts/StudentLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ClassHome } from './pages/ClassHome'
import { AdminClasses } from './pages/AdminClasses'
import { AdminUsers } from './pages/AdminUsers'
import { AdminTeams } from './pages/AdminTeams'
import { Board } from './pages/Board'
import { PostDetail } from './pages/PostDetail'
import { PostForm } from './pages/PostForm'

function AssignmentList() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">과제 목록</h1>
      <p className="text-sm text-gray-500">Phase 3-9에서 구현 예정</p>
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

// 초기 로딩 스피너
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
      <div className="animate-spin w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full" />
    </div>
  )
}

// 홈 리다이렉트 - 역할에 따라 적절한 페이지로 이동
function HomeRedirect() {
  const { isAuthenticated, isLoading, user } = useAuthStore()

  if (isLoading) return <LoadingScreen />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role === 'teacher') {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to={`/class/${user?.class_id}`} replace />
}

export default function App() {
  const { checkAuth, isLoading } = useAuthStore()

  // 앱 시작 시 인증 상태 확인
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      {/* 홈 - 역할에 따라 리다이렉트 */}
      <Route path="/" element={<HomeRedirect />} />

      {/* 로그인 - 비로그인 전용 */}
      <Route
        path="/login"
        element={
          <GuestGuard>
            <Login />
          </GuestGuard>
        }
      />

      {/* 교사 전용 라우트 */}
      <Route
        element={
          <AuthGuard requireRole="teacher">
            <TeacherLayout />
          </AuthGuard>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/classes" element={<AdminClasses />} />
        <Route path="/admin/classes/:classId/teams" element={<AdminTeams />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        {/* 교사 게시판 */}
        <Route path="/class/:classId/board" element={<Board />} />
        <Route path="/class/:classId/board/new" element={<PostForm />} />
        <Route path="/class/:classId/board/:postId/edit" element={<PostForm />} />
      </Route>

      {/* 학생 전용 라우트 */}
      <Route
        path="/class/:classId"
        element={
          <AuthGuard requireRole="student">
            <StudentLayout />
          </AuthGuard>
        }
      >
        <Route index element={<ClassHome />} />
        <Route path="posts" element={<Board />} />
        <Route path="assignments" element={<AssignmentList />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      {/* 학생 게시물 상세 (별도 페이지) */}
      <Route
        path="/class/:classId/posts/:postId"
        element={
          <AuthGuard requireRole="student">
            <PostDetail />
          </AuthGuard>
        }
      />
      <Route
        path="/class/:classId/posts/:postId/edit"
        element={
          <AuthGuard requireRole="student">
            <PostForm />
          </AuthGuard>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
