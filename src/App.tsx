import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Bookmark, Check, ChevronDown, CircleHelp, Clock3, GraduationCap, LogOut, Menu, Moon, Search, Sparkles, Sun, X } from 'lucide-react'
import { isSupabaseConfigured, supabase, type Course, type Profile } from './lib/supabase'
const VideoRoom = lazy(() => import('./components/VideoRoom').then(module => ({ default: module.VideoRoom })))
const AuthPage = lazy(() => import('./pages/AuthPage').then(module => ({ default: module.AuthPage })))
const HomePage = lazy(() => import('./pages/Pages').then(module => ({ default: module.HomePage })))
const CoursesPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.CoursesPage })))
const CoursePage = lazy(() => import('./pages/Pages').then(module => ({ default: module.CoursePage })))
const DashboardPage = lazy(() => import('./pages/Pages').then(module => ({ default: module.DashboardPage })))
const LessonPage = lazy(() => import('./pages/Lessons').then(module => ({ default: module.LessonPage })))

type AppContextType = {
  session: { user: { id: string; email?: string } } | null
  profile: Profile | null
  courses: Course[]
  enrollments: string[]
  notice: string
  tell: (message: string) => void
  refreshCourses: () => Promise<void>
}
const AppContext = createContext<AppContextType | null>(null)
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('useApp doit être utilisé dans App'); return value }

export default function App() {
  const [session, setSession] = useState<AppContextType['session']>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [courses, setCourses] = useState<Course[]>(() => { try { return JSON.parse(localStorage.getItem('forma-courses') || '[]') as Course[] } catch { return [] } })
  const [enrollments, setEnrollments] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('forma-theme') === 'dark')
  const tell = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 4500) }
  const refreshCourses = async () => {
    const { data, error } = await supabase.from('courses').select('id,title,description,category,trainer_id,created_at,profiles(full_name)').order('created_at', { ascending: false })
    if (error) { if (isSupabaseConfigured) tell(error.message); return }
    const fresh = (data ?? []) as unknown as Course[]; setCourses(fresh); try { localStorage.setItem('forma-courses', JSON.stringify(fresh)) } catch { /* cache storage is optional */ }
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setProfile(null); setEnrollments([]); return }
    supabase.from('profiles').select('id,full_name,role').eq('id', session.user.id).single().then(({ data }) => setProfile(data as Profile | null))
    supabase.from('enrollments').select('course_id').eq('student_id', session.user.id).then(({ data }) => setEnrollments((data ?? []).map(row => row.course_id)))
  }, [session])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    void refreshCourses()
    const channel = supabase.channel('course-catalog').on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => { void refreshCourses() }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  // refreshCourses is intentionally stable for the lifetime of the app.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('forma-theme', dark ? 'dark' : 'light') }, [dark])
  const value = useMemo(() => ({ session, profile, courses, enrollments, notice, tell, refreshCourses }), [session, profile, courses, enrollments, notice])
  return <AppContext.Provider value={value}><BrowserRouter><Suspense fallback={<div className="route-loading"><span className="loading-spinner"/>Chargement de votre espace…</div>}><Routes><Route element={<SiteLayout dark={dark} toggleTheme={() => setDark(v => !v)} />}><Route path="/" element={<HomePage/>}/><Route path="/formations" element={<CoursesPage/>}/><Route path="/formations/:courseId" element={<CoursePage/>}/><Route path="/formations/:courseId/lecons/:lessonId" element={<LessonPage/>}/><Route path="/dashboard" element={<DashboardPage/>}/></Route><Route path="/connexion" element={<AuthPage mode="login"/>}/><Route path="/inscription" element={<AuthPage mode="signup"/>}/><Route path="/salle/:courseId" element={<RoomRoute/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense>{notice&&<div className="toast"><Check size={16}/>{notice}<button onClick={()=>setNotice('')} aria-label="Fermer"><X size={15}/></button></div>}{!isSupabaseConfigured&&<div className="config-note"><CircleHelp size={15}/> Ajoutez les clés Supabase dans .env</div>}</BrowserRouter></AppContext.Provider>
}

function SiteLayout({dark,toggleTheme}:{dark:boolean;toggleTheme:()=>void}) {
  const { session, profile } = useApp(); const [menu,setMenu]=useState(false); const [searchOpen,setSearchOpen]=useState(false); const navigate=useNavigate()
  async function logout(){await supabase.auth.signOut();navigate('/')}
  return <div className="site-shell"><header className="site-header"><Link className="brand" to="/"><span className="brand-mark"><Sparkles size={18} fill="currentColor"/></span><span>forma</span><i>.</i></Link><button className="mobile-menu-btn" onClick={()=>setMenu(v=>!v)} aria-label="Ouvrir le menu">{menu?<X/>:<Menu/>}</button><nav className={menu?'main-nav nav-open':'main-nav'}><NavLink to="/" onClick={()=>setMenu(false)}>Accueil</NavLink><NavLink to="/formations" onClick={()=>setMenu(false)}>Formations</NavLink><a href="/#direct" onClick={()=>setMenu(false)}>Cours en direct</a>{session&&<NavLink to="/dashboard" onClick={()=>setMenu(false)}>Mon espace</NavLink>}</nav><div className="header-actions"><button className="header-icon" onClick={toggleTheme} title={dark?'Passer au thème clair':'Passer au thème sombre'}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="header-icon search-trigger" onClick={()=>setSearchOpen(v=>!v)} title="Rechercher"><Search size={18}/></button>{session?<><button className="profile-pill" onClick={()=>navigate('/dashboard')}><span className="avatar">{profile?.full_name?.slice(0,1).toUpperCase()??'F'}</span><span>{profile?.full_name?.split(' ')[0]??'Mon espace'}</span><ChevronDown size={14}/></button><button className="header-icon logout-btn" onClick={logout} title="Déconnexion"><LogOut size={17}/></button></>:<><Link className="header-login" to="/connexion">Connexion</Link><Link className="button button-primary button-nav" to="/inscription">Commencer <ArrowRight size={15}/></Link></>}</div></header>{searchOpen&&<div className="global-search"><Search size={18}/><input autoFocus placeholder="Rechercher une formation..." onKeyDown={e=>{if(e.key==='Enter'){navigate(`/formations?q=${encodeURIComponent(e.currentTarget.value)}`);setSearchOpen(false)}}}/><button onClick={()=>setSearchOpen(false)}><X size={17}/></button></div>}<Outlet/><Footer/></div>
}

export function CourseCard({course,index=0,progress,onClick}:{course:Course;index?:number;progress?:number;onClick?:()=>void}) {
  const palettes=['violet','blue','amber','mint']; const imageIds=['photo-1516321318423-f06f85e504b3','photo-1521737711867-e3b97375f902','photo-1558655146-9f40138edfeb','photo-1498050108023-c5249f4df085']
  const image=`https://images.unsplash.com/${imageIds[index%imageIds.length]}?auto=format&fit=crop&w=900&q=80`
  const [saved,setSaved]=useState(false)
  return <article className="course-card transition-all duration-300 hover:-translate-y-1" onClick={onClick}><div className={`course-cover ${palettes[index%4]}`} ><img src={image} alt="" loading="lazy" decoding="async"/><span className="course-category">{course.category||'Formation'}</span><button className={`bookmark ${saved?'is-saved':''}`} aria-label={saved?'Retirer des favoris':'Ajouter aux favoris'} aria-pressed={saved} onClick={e=>{e.stopPropagation();setSaved(v=>!v)}}><Bookmark size={15} fill={saved?'currentColor':'none'}/></button><span className="cover-level">À découvrir</span></div><div className="course-card-content"><div className="course-meta"><span><Clock3 size={13}/> 4 h 30</span><span><GraduationCap size={14}/> Tous niveaux</span></div><h3>{course.title}</h3><div className="course-teacher"><span className="avatar teacher-avatar">{course.profiles?.full_name?.slice(0,1).toUpperCase()??'F'}</span><span>{course.profiles?.full_name??'Formateur Forma'}</span><span className="rating">★ 4.9</span></div>{progress!==undefined&&<div className="progress-wrap"><div className="progress-label"><span>Votre progression</span><b>{progress}%</b></div><div className="progress-track"><span style={{width:`${progress}%`}}/></div></div>}<button className="course-start" onClick={e=>{e.stopPropagation();onClick?.()}}>Découvrir le cours <ArrowRight size={15}/></button></div></article>
}

export function SectionHeading({eyebrow,title,action,link}:{eyebrow?:string;title:string;action?:string;link?:string}) { return <div className="section-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>{action&&<Link className="section-link" to={link??'/formations'}>{action}<ArrowRight size={16}/></Link>}</div> }

export function CreateCourseModal({close}:{close:()=>void}) {
  const {session,tell,refreshCourses}=useApp(); const [busy,setBusy]=useState(false)
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!session)return;setBusy(true);const f=new FormData(e.currentTarget);const {error}=await supabase.from('courses').insert({title:f.get('title'),category:f.get('category'),description:f.get('description'),trainer_id:session.user.id});setBusy(false);if(error){tell(error.message);return}await refreshCourses();tell('Votre formation est publiée.');close()}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal-card"><button className="modal-x" onClick={close}><X/></button><div className="eyebrow">ESPACE FORMATEUR</div><h2>Créer une formation</h2><p>Donnez envie d’apprendre : un bon titre et quelques lignes suffisent.</p><form onSubmit={submit}><label>Titre<input name="title" required minLength={3} maxLength={90} placeholder="Ex. Design graphique, les fondamentaux"/></label><label>Catégorie<input name="category" required maxLength={40} placeholder="Ex. Design"/></label><label>Description<textarea name="description" required maxLength={500} rows={4} placeholder="Ce que les étudiants vont découvrir…"/></label><button className="button button-primary button-wide" disabled={busy}>{busy?'Publication…':'Publier la formation'}<ArrowRight size={16}/></button></form></section></div>
}

function Footer(){return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><Link className="brand" to="/"><span className="brand-mark"><Sparkles size={18} fill="currentColor"/></span>forma<i>.</i></Link><p>Le plaisir d’apprendre,<br/>la liberté d’aller plus loin.</p></div><div><b>Explorer</b><Link to="/formations">Toutes les formations</Link><a href="/#direct">Cours en direct</a></div><div><b>La plateforme</b><a href="/#avantages">Pourquoi Forma ?</a><Link to="/inscription">Devenir formateur</Link></div><div className="footer-newsletter"><b>Une idée en tête ?</b><p>Votre prochain chapitre commence ici.</p><Link className="button button-light" to="/formations">Découvrir Forma <ArrowRight size={15}/></Link></div></div><div className="footer-bottom"><span>© 2026 Forma Learning</span><span>Conçu pour apprendre, ensemble.</span><div><a href="#confidentialite">Confidentialité</a><a href="#conditions">Conditions</a></div></div></footer>}

function RoomRoute(){const {courseId=''}=useParams();const {courses,profile,session}=useApp();const course=courses.find(c=>c.id===courseId)??null;return <VideoRoom course={course} session={session} profile={profile} onBack={()=>window.history.back()}/>}
