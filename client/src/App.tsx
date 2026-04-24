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
import { AssignmentList } from './pages/AssignmentList'
import { AssignmentDetail } from './pages/AssignmentDetail'
import { AssignmentForm } from './pages/AssignmentForm'
import { SubmissionList } from './pages/SubmissionList'
import { SubmissionDetail } from './pages/SubmissionDetail'

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

// 역할 기반 레이아웃 래퍼 - 교사면 TeacherLayout, 학생이면 StudentLayout
function RoleBasedLayout() {
  const { user } = useAuthStore()

  if (user?.role === 'teacher') {
    return <TeacherLayout />
  }

  return <StudentLayout />
}

// 학생 상세 페이지 래퍼 (간단한 레이아웃)
function StudentPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[430px] mx-auto min-h-screen flex flex-col bg-[#F7F6F3]">
      <main className="flex-1 p-4">
        {children}
      </main>
    </div>
  )
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

      {/* 교사 전용 라우트 (대시보드, 관리) */}
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
        {/* 교사 과제 출제/수정 */}
        <Route path="/class/:classId/assignments/new" element={<AssignmentForm />} />
        <Route path="/class/:classId/assignments/:assignmentId/edit" element={<AssignmentForm />} />
        {/* 교사 제출 현황 */}
        <Route path="/class/:classId/assignments/:assignmentId/submissions" element={<SubmissionList />} />
        <Route path="/class/:classId/assignments/:assignmentId/submissions/:submissionId" element={<SubmissionDetail />} />
      </Route>

      {/* 학생 전용 라우트 (홈, 게시판, 프로필) */}
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
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      {/*
        공통 과제 라우트 (교사/학생 모두 접근 가능)
        - 역할에 따라 다른 레이아웃 적용
      */}
      <Route
        path="/class/:classId/assignments"
        element={
          <AuthGuard>
            <RoleBasedLayout />
          </AuthGuard>
        }
      >
        <Route index element={<AssignmentList />} />
        <Route path=":assignmentId" element={<AssignmentDetail />} />
      </Route>

      {/* 학생 게시물 상세 (별도 페이지 - 하단 네비 없음) */}
      <Route
        path="/class/:classId/posts/:postId"
        element={
          <AuthGuard requireRole="student">
            <StudentPageWrapper>
              <PostDetail />
            </StudentPageWrapper>
          </AuthGuard>
        }
      />
      <Route
        path="/class/:classId/posts/:postId/edit"
        element={
          <AuthGuard requireRole="student">
            <StudentPageWrapper>
              <PostForm />
            </StudentPageWrapper>
          </AuthGuard>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
