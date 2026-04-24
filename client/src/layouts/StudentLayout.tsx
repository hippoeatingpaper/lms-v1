import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Home, FileText, ClipboardList, User, Bell } from 'lucide-react'

export function StudentLayout() {
  const { classId } = useParams()

  const navItems = [
    { to: `/class/${classId}`, icon: Home, label: '홈', end: true },
    { to: `/class/${classId}/posts`, icon: FileText, label: '게시판' },
    { to: `/class/${classId}/assignments`, icon: ClipboardList, label: '과제' },
    { to: `/class/${classId}/profile`, icon: User, label: '내 정보' },
  ]

  return (
    <div className="max-w-[430px] mx-auto min-h-screen flex flex-col bg-[#F7F6F3]">
      {/* Top Bar */}
      <header className="sticky top-0 h-14 bg-white border-b border-black/10 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#534AB7] rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-medium">C</span>
          </div>
          <span className="font-medium text-[14px]">Classroom</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-500 hover:text-gray-700 relative">
            <Bell size={20} strokeWidth={1.5} />
            {/* 알림 뱃지 (추후 구현) */}
            {/* <span className="absolute top-1 right-1 w-2 h-2 bg-[#993C1D] rounded-full" /> */}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto h-16 bg-white border-t border-black/10 flex items-center justify-around px-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-[#534AB7]' : 'text-gray-400'
              }`
            }
          >
            <item.icon size={22} strokeWidth={1.5} />
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// 학생 프로필 페이지 (간단한 placeholder)
export function StudentProfile() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">내 정보</h1>

      <div className="bg-white rounded-xl p-4 border border-black/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-[#EEEDFE] rounded-full flex items-center justify-center">
            <User size={24} className="text-[#534AB7]" />
          </div>
          <div>
            <p className="font-medium text-[15px]">{user?.name}</p>
            <p className="text-[12px] text-gray-500">@{user?.username}</p>
          </div>
        </div>

        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between py-2 border-b border-black/5">
            <span className="text-gray-500">역할</span>
            <span>학생</span>
          </div>
          {user?.class_name && (
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-gray-500">반</span>
              <span>{user.class_name}</span>
            </div>
          )}
          {user?.team_id && (
            <div className="flex justify-between py-2 border-b border-black/5">
              <span className="text-gray-500">팀</span>
              <span>{user.team_name || `팀 ${user.team_id}`}</span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full py-3 text-[13px] text-[#993C1D] bg-[#FAECE7] rounded-lg hover:bg-[#f5ddd5] transition-colors"
      >
        로그아웃
      </button>
    </div>
  )
}
