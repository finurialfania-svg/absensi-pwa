import { useEffect, useMemo, useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { Activity, BookOpen, CalendarDays, CheckCircle2, Download, LogOut, Plus, Search, ShieldCheck, Users, XCircle } from 'lucide-react'
import { auth, db, firebaseConfigured } from './firebase'
import { ensureProfile, useAuth } from './auth'

type Session = { id: string; title: string; course: string; code: string; active: boolean; createdAt?: any; expiresAt: string }
type Attendance = { id: string; studentId: string; studentName: string; nim: string; sessionId: string; sessionTitle: string; status: string; createdAt?: any }
type Person = { id: string; name: string; nim: string; email: string; role: string }
const dateText = (v: any) => v?.toDate ? v.toDate().toLocaleString('id-ID') : v ? new Date(v).toLocaleString('id-ID') : '-'
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export default function App() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [tab, setTab] = useState('overview')
  const [sessions, setSessions] = useState<Session[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [sessionTitle, setSessionTitle] = useState('')
  const [course, setCourse] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [nim, setNim] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login'|'register'>('login')
  const admin = profile?.role === 'admin'

  useEffect(() => {
    if (!user) return
    const unsubs = [
      
      onSnapshot(
        query(collection(db, 'sessions'), orderBy('createdAt', 'desc')),
        s => setSessions(s.docs.map(d => ({ id: d.id, ...d.data() } as Session))),
        e => console.error(e)
      )

    // Firestore rules only allow students to read their own attendance.
    const attendanceQuery = admin
      ? query(collection(db, 'attendance'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'attendance'), where('studentId', '==', user.uid))
    unsubs.push(onSnapshot(attendanceQuery, s => {
      const rows = s.docs.map(d => ({ id:d.id, ...d.data() } as Attendance))
      rows.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      setAttendance(rows)
    }, e => console.error(e)))
    if (admin) unsubs.push(onSnapshot(collection(db, 'users'), s => setPeople(s.docs.map(d => ({ id:d.id, ...d.data() } as Person)))))
    return () => unsubs.forEach(u => u())
  }, [user, admin])

  const mine = useMemo(() => attendance.filter(a => a.studentId === user?.uid), [attendance, user])
  const filtered = useMemo(() => attendance.filter(a => `${a.studentName} ${a.nim} ${a.sessionTitle}`.toLowerCase().includes(search.toLowerCase())), [attendance, search])
  const notify = (s: string) => { setNotice(s); window.setTimeout(() => setNotice(''), 4000) }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      if (mode === 'register') {
        if (!name.trim() || !nim.trim()) throw new Error('Nama dan NIM wajib diisi.')
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(cred.user, { displayName: name })
        await ensureProfile(cred.user, name, nim)
        await refreshProfile()
      } else await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) { notify(err.message || 'Gagal masuk.') } finally { setBusy(false) }
  }
  async function createSession(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionTitle.trim() || !course.trim() || !expiresAt) return notify('Lengkapi judul, mata kuliah, dan waktu berakhir.')
    try {
      await addDoc(collection(db, 'sessions'), { title: sessionTitle, course, code: makeCode(), active: true, createdAt: serverTimestamp(), expiresAt })
      setSessionTitle(''); setCourse(''); setExpiresAt(''); notify('Sesi absensi berhasil dibuat.')
    } catch (e: any) { notify(e.message) }
  }
  async function checkIn(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !user) return
    const target = sessions.find(s => s.code.toUpperCase() === code.trim().toUpperCase() && s.active && new Date(s.expiresAt).getTime() > Date.now())
    if (!target) return notify('Kode tidak valid, sesi ditutup, atau sudah kedaluwarsa.')
    if (mine.some(a => a.sessionId === target.id)) return notify('Kamu sudah tercatat hadir pada sesi ini.')
    try {
      await addDoc(collection(db, 'attendance'), { studentId:user.uid, studentName:profile.name, nim:profile.nim, sessionId:target.id, sessionTitle:target.title, status:'hadir', createdAt:serverTimestamp() })
      setCode(''); notify('Absensi berhasil dicatat.'); setTab('history')
    } catch (e: any) { notify(e.message) }
  }
  async function toggleSession(s: Session) { try { await updateDoc(doc(db,'sessions',s.id), { active:!s.active }); notify(s.active ? 'Sesi ditutup.' : 'Sesi dibuka.') } catch(e:any) { notify(e.message) } }
  async function removeSession(s: Session) { if (!confirm(`Hapus sesi "${s.title}"?`)) return; try { await deleteDoc(doc(db,'sessions',s.id)); notify('Sesi dihapus.') } catch(e:any) { notify(e.message) } }
  async function changeRole(p: Person) { const role = p.role === 'admin' ? 'student' : 'admin'; if (!confirm(`Ubah role ${p.name} menjadi ${role}?`)) return; try { await updateDoc(doc(db,'users',p.id), { role }); notify('Role diperbarui.') } catch(e:any) { notify(e.message) } }
  function exportCsv() {
    const rows = [['Nama','NIM','Sesi','Status','Waktu'], ...filtered.map(a => [a.studentName,a.nim,a.sessionTitle,a.status,dateText(a.createdAt)])]
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'}))
    const a = document.createElement('a'); a.href=url; a.download='rekap-absensi.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (!firebaseConfigured) return <div className="setup"><div className="brand-mark">H</div><h1>Konfigurasi Firebase belum diisi</h1><p>Salin <b>.env.example</b> menjadi <b>.env</b>, isi kredensial Firebase Web App, lalu jalankan ulang <code>npm run dev</code>.</p><p>Panduan lengkap ada di README.md.</p></div>
  if (loading) return <div className="setup">Memuat HadirKu…</div>
  if (!user) return <main className="auth-wrap"><section className="auth-card"><div className="brand-mark">H</div><p className="eyebrow">PORTAL KAMPUS</p><h1>HadirKu</h1><p className="muted">Absensi mahasiswa jadi lebih mudah.</p><div className="auth-tabs"><button className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Masuk</button><button className={mode==='register'?'selected':''} onClick={()=>setMode('register')}>Daftar</button></div><form onSubmit={submitAuth} className="form">
    {mode==='register' && <><label>Nama lengkap<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama mahasiswa" required /></label><label>NIM<input value={nim} onChange={e=>setNim(e.target.value)} placeholder="Nomor induk mahasiswa" required /></label></>}
    <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" required /></label><label>Password<input type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 6 karakter" required /></label><button className="primary full" disabled={busy}>{busy?'Memproses…':mode==='login'?'Masuk ke akun':'Buat akun mahasiswa'}</button></form><p className="tiny muted">Akun baru otomatis menjadi mahasiswa. Admin ditetapkan melalui Firebase Console.</p>{notice&&<p className="notice">{notice}</p>}</section></main>

  return <div className="app-shell"><aside className="sidebar"><div className="logo"><span className="brand-mark small">H</span><b>HadirKu</b></div><div className="side-label">MENU UTAMA</div><nav>
    <button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><Activity size={18}/> Ringkasan</button>
    {admin ? <><button className={tab==='sessions'?'active':''} onClick={()=>setTab('sessions')}><CalendarDays size={18}/> Kelola sesi</button><button className={tab==='reports'?'active':''} onClick={()=>setTab('reports')}><BookOpen size={18}/> Rekap absensi</button><button className={tab==='users'?'active':''} onClick={()=>setTab('users')}><Users size={18}/> Pengguna</button></> : <><button className={tab==='checkin'?'active':''} onClick={()=>setTab('checkin')}><CheckCircle2 size={18}/> Isi absensi</button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}><BookOpen size={18}/> Riwayat saya</button></>}
  </nav><div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{(profile?.name||'M').slice(0,1).toUpperCase()}</div><div><b>{profile?.name||user.email}</b><small>{admin?'Administrator':'Mahasiswa'}</small></div></div><button className="logout" onClick={()=>signOut(auth)}><LogOut size={17}/> Keluar</button></div></aside>
  <main className="main"><header className="topbar"><div><p className="eyebrow">PORTAL AKADEMIK</p><h1>{tab==='overview'?'Ringkasan':tab==='sessions'?'Kelola sesi':tab==='reports'?'Rekap absensi':tab==='users'?'Manajemen pengguna':tab==='checkin'?'Isi absensi':'Riwayat absensi'}</h1></div><div className="top-user"><span className="status-dot"/><span>{profile?.name}</span><span className="role-chip">{admin?'ADMIN':'MAHASISWA'}</span></div></header>
  {notice&&<div className="toast">{notice}<button onClick={()=>setNotice('')}><XCircle size={16}/></button></div>}
  {tab==='overview' && <><section className="welcome"><div><p className="eyebrow light">SELAMAT DATANG</p><h2>Halo, {profile?.name?.split(' ')[0]||'Mahasiswa'}! 👋</h2><p>{admin?'Pantau aktivitas dan kelola kehadiran mahasiswa.':'Pastikan kehadiran kuliahmu tercatat dengan benar.'}</p></div><div className="welcome-icon"><ShieldCheck size={54}/></div></section><div className="stats"><Stat icon={<CalendarDays/>} label="Sesi aktif" value={sessions.filter(s=>s.active && new Date(s.expiresAt).getTime()>Date.now()).length}/><Stat icon={<CheckCircle2/>} label={admin?'Total kehadiran':'Kehadiran saya'} value={admin?attendance.length:mine.length}/><Stat icon={<Users/>} label={admin?'Total pengguna':'Total sesi tersedia'} value={admin?people.length:sessions.length}/></div><section className="panel"><div className="panel-head"><div><h3>{admin?'Sesi terbaru':'Sesi yang tersedia'}</h3><p className="muted">Daftar sesi perkuliahan</p></div>{admin&&<button className="secondary" onClick={()=>setTab('sessions')}><Plus size={16}/> Buat sesi</button>}</div><SessionList sessions={sessions.slice(0,5)} admin={admin} toggle={toggleSession} remove={removeSession}/></section></>}
  {tab==='checkin'&&!admin&&<section className="panel narrow"><div className="panel-head"><div><h3>Masukkan kode absensi</h3><p className="muted">Minta kode sesi kepada dosen atau admin.</p></div><div className="soft-icon"><CheckCircle2/></div></div><form onSubmit={checkIn} className="form"><label>Kode sesi<input className="code-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="CONTOH: A1B2C3" maxLength={6} required /></label><button className="primary full">Kirim absensi</button></form><p className="tiny muted">Pastikan kode masih aktif dan belum melewati waktu berakhir.</p></section>}
  {tab==='history'&&!admin&&<section className="panel"><div className="panel-head"><div><h3>Riwayat kehadiran</h3><p className="muted">Catatan absensi akunmu.</p></div></div><AttendanceTable rows={mine}/></section>}
  {tab==='sessions'&&admin&&<><section className="panel"><div className="panel-head"><div><h3>Buat sesi absensi</h3><p className="muted">Kode sesi dibuat otomatis untuk mahasiswa.</p></div></div><form onSubmit={createSession} className="form form-grid"><label>Nama sesi<input value={sessionTitle} onChange={e=>setSessionTitle(e.target.value)} placeholder="Pertemuan 1 — Pengantar" required /></label><label>Mata kuliah<input value={course} onChange={e=>setCourse(e.target.value)} placeholder="Pemrograman Web" required /></label><label className="span-2">Batas waktu<input type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} required /></label><button className="primary"><Plus size={17}/> Buat sesi</button></form></section><section className="panel"><div className="panel-head"><h3>Semua sesi</h3></div><SessionList sessions={sessions} admin toggle={toggleSession} remove={removeSession}/></section></>}
  {tab==='reports'&&admin&&<section className="panel"><div className="panel-head"><div><h3>Rekap kehadiran</h3><p className="muted">{filtered.length} catatan ditemukan</p></div><button className="secondary" onClick={exportCsv}><Download size={16}/> Ekspor CSV</button></div><div className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, NIM, atau sesi…"/></div><AttendanceTable rows={filtered}/></section>}
  {tab==='users'&&admin&&<section className="panel"><div className="panel-head"><div><h3>Pengguna terdaftar</h3><p className="muted">Kelola hak akses admin dan mahasiswa.</p></div></div><div className="table-wrap"><table><thead><tr><th>Nama</th><th>NIM</th><th>Email</th><th>Role</th><th>Aksi</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.nim||'-'}</td><td>{p.email}</td><td><span className="role-chip">{p.role}</span></td><td><button className="text-btn" disabled={p.id===user.uid} onClick={()=>changeRole(p)}>Ubah role</button></td></tr>)}</tbody></table></div></section>}
  <footer>© {new Date().getFullYear()} HadirKu · PWA Absensi Mahasiswa</footer></main></div>
}
function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:number}) { return <div className="stat-card"><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong></div></div> }
function SessionList({sessions,admin,toggle,remove}:{sessions:Session[];admin:boolean;toggle:(s:Session)=>void;remove:(s:Session)=>void}) {
  if(!sessions.length)return <div className="empty">Belum ada sesi absensi.</div>
  return <div className="session-list">{sessions.map(s=><div className="session-row" key={s.id}><div className="session-icon"><CalendarDays/></div><div className="session-info"><b>{s.title}</b><span>{s.course} · Berakhir {dateText(s.expiresAt)}</span><div className="session-code">Kode: <strong>{s.code}</strong></div></div><div className="session-actions"><span className={`pill ${s.active?'green':'gray'}`}>{s.active?'Aktif':'Ditutup'}</span>{admin&&<><button className="text-btn" onClick={()=>toggle(s)}>{s.active?'Tutup':'Buka'}</button><button className="icon-btn" onClick={()=>remove(s)} title="Hapus"><XCircle size={17}/></button></>}</div></div>)}</div>
}
function AttendanceTable({rows}:{rows:Attendance[]}) {
  if(!rows.length)return <div className="empty">Belum ada data absensi.</div>
  return <div className="table-wrap"><table><thead><tr><th>Mahasiswa</th><th>NIM</th><th>Sesi</th><th>Status</th><th>Waktu</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td>{a.studentName}</td><td>{a.nim}</td><td>{a.sessionTitle}</td><td><span className="pill green">Hadir</span></td><td>{dateText(a.createdAt)}</td></tr>)}</tbody></table></div>
}
