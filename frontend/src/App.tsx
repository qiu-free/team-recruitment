import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, type Application, type Project, type ProjectDetail, type User } from './api';

type View = 'explore' | 'mine' | 'created' | 'profile';
type Feedback = { tone: 'success' | 'error' | 'info'; text: string } | null;

const statusText: Record<Application['status'], string> = {
  pending: '待审核', approved: '已通过', rejected: '已拒绝', withdrawn: '已撤回'
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    api.me().then(({ user: current }) => setUser(current)).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><span className="pulse-dot" />正在打开组队集市…</div>;
  if (!user) return <Login onLoggedIn={setUser} onError={setFeedback} feedback={feedback} />;
  return <Workspace user={user} onUserChange={setUser} onLogout={() => { void api.logout(); setUser(null); }} feedback={feedback} setFeedback={setFeedback} />;
}

function Login({ onLoggedIn, onError, feedback }: { onLoggedIn: (user: User) => void; onError: (feedback: Feedback) => void; feedback: Feedback }) {
  const [username, setUsername] = useState('bob');
  const [password, setPassword] = useState('demo1234');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); onError(null);
    try { onLoggedIn((await api.login(username, password)).user); }
    catch (error) { onError({ tone: 'error', text: error instanceof Error ? error.message : '登录失败' }); }
    finally { setBusy(false); }
  };
  return <main className="login-shell">
    <div className="login-visual"><div className="eyebrow">PROJECT MARKET / 07</div><h1>找到愿意<br /><em>一起做事</em>的人。</h1><p>把一个想法变成真实项目，从一张清晰的招募卡片开始。</p><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="sticker">REAL<br />PROJECTS<br /><strong>→</strong></div></div>
    <form className="login-card" onSubmit={submit}><div className="eyebrow">学生项目组队平台</div><h2>欢迎回来</h2><p className="muted">使用预置测试账号进入 Demo</p><label>账号<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label><label>密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>{feedback && <div className="inline-error">{feedback.text}</div>}<button className="primary" disabled={busy}>{busy ? '登录中…' : '进入工作台'} <span>↗</span></button><div className="account-hints"><span>alice</span><span>bob</span><span>cathy</span><span>david</span><small>统一密码：demo1234</small></div></form>
  </main>;
}

function Workspace({ user, onUserChange, onLogout, feedback, setFeedback }: { user: User; onUserChange: (user: User) => void; onLogout: () => void; feedback: Feedback; setFeedback: (feedback: Feedback) => void }) {
  const [view, setView] = useState<View>('explore');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((key) => key + 1);
  const navigate = (next: View) => { setView(next); setSelectedId(null); };
  return <div className="app-shell"><header className="topbar"><button className="brand" onClick={() => navigate('explore')}><span className="brand-mark">✳</span><span>组队集市<small>TEAM MARKET</small></span></button><nav><NavButton active={view === 'explore'} onClick={() => navigate('explore')}>发现项目</NavButton><NavButton active={view === 'mine'} onClick={() => navigate('mine')}>我的申请</NavButton><NavButton active={view === 'created'} onClick={() => navigate('created')}>我发起的</NavButton></nav><div className="user-menu"><span className="avatar">{user.nickname.slice(0, 1)}</span><span className="user-name">{user.nickname}<small>@{user.username}</small></span><button className="logout" onClick={onLogout}>退出</button></div></header><div className="page-wrap">{feedback && <div className={`feedback ${feedback.tone}`} role="alert"><span>{feedback.tone === 'error' ? '!' : '✓'}</span>{feedback.text}<button onClick={() => setFeedback(null)}>×</button></div>}{view === 'explore' && !selectedId && <Explore onSelect={setSelectedId} onFeedback={setFeedback} refreshKey={refreshKey} />}{view === 'explore' && selectedId && <ProjectPage id={selectedId} user={user} onBack={() => setSelectedId(null)} onFeedback={setFeedback} refresh={refresh} />}{view === 'mine' && <MyApplications onFeedback={setFeedback} refreshKey={refreshKey} />}{view === 'created' && <CreatedProjects user={user} onSelect={setSelectedId} onFeedback={setFeedback} refreshKey={refreshKey} onRefresh={refresh} />}{view === 'profile' && <ProfilePage user={user} onUserChange={onUserChange} onFeedback={setFeedback} />}</div><button className="profile-fab" onClick={() => navigate('profile')}>编辑资料 <span>↗</span></button></div>;
}

function NavButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) { return <button className={active ? 'nav-link active' : 'nav-link'} onClick={onClick}>{children}</button>; }

function Explore({ onSelect, onFeedback, refreshKey }: { onSelect: (id: string) => void; onFeedback: (feedback: Feedback) => void; refreshKey: number }) {
  const [projects, setProjects] = useState<Project[]>([]); const [busy, setBusy] = useState(true); const [keyword, setKeyword] = useState(''); const [role, setRole] = useState(''); const [skills, setSkills] = useState('');
  const load = () => { setBusy(true); api.projects({ keyword, role, skills: skills.split(',').map((skill) => skill.trim()).filter(Boolean) }).then(({ projects: next }) => setProjects(next)).catch((error) => onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '项目加载失败' })).finally(() => setBusy(false)); };
  useEffect(load, [refreshKey]);
  return <section><div className="hero-row"><div><div className="eyebrow">DISCOVER / 发现</div><h1 className="page-title">把想法，组<br /><em>成一队。</em></h1><p className="lead">浏览正在发生的项目，找到你能真正贡献的角色。</p></div><div className="hero-note"><span className="note-arrow">↘</span><strong>{projects.length || '—'}</strong><span>个项目正在寻找<br />下一位伙伴</span></div></div><div className="filter-bar"><div className="search-field"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} placeholder="搜索项目标题、目标或进展" /></div><input value={role} onChange={(event) => setRole(event.target.value)} placeholder="角色，如：前端" /><input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="技能，逗号分隔" /><button className="filter-button" onClick={load}>筛选 <span>↗</span></button></div>{busy ? <LoadingBlock /> : projects.length === 0 ? <EmptyState title="没有找到匹配项目" text="换个关键词，或者稍后再来看看。" /> : <div className="project-grid">{projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onClick={() => onSelect(project.id)} />)}</div>}<p className="seed-hint">测试素材已准备：alice / bob / cathy / david · 密码 demo1234</p></section>;
}

function ProjectCard({ project, index, onClick }: { project: Project; index: number; onClick: () => void }) { const accent = ['coral', 'blue', 'yellow'][index % 3]; return <article className={`project-card ${accent}`} onClick={onClick}><div className="card-top"><span className="project-index">0{index + 1}</span><span className={project.recruitmentPaused ? 'status paused' : project.allRolesFull ? 'status full' : 'status open'}>{project.recruitmentPaused ? '暂停招募' : project.allRolesFull ? '已满员' : '招募中'}</span></div><h3>{project.title}</h3><p>{project.goal}</p><div className="role-list">{project.roles.map((role) => <span key={role.id} className={role.remaining ? '' : 'role-full'}>{role.name}<b>{role.remaining ? `缺 ${role.remaining}` : '已满'}</b></span>)}</div><div className="card-footer"><span>发起人 {project.owner.nickname}</span><span className="arrow">↗</span></div></article>; }

function ProjectPage({ id, user, onBack, onFeedback, refresh }: { id: string; user: User; onBack: () => void; onFeedback: (feedback: Feedback) => void; refresh: () => void }) {
  const [project, setProject] = useState<ProjectDetail | null>(null); const [busy, setBusy] = useState(true);
  const load = () => { setBusy(true); api.project(id).then(({ project: next }) => setProject(next)).catch((error) => onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '项目加载失败' })).finally(() => setBusy(false)); };
  useEffect(load, [id]);
  if (busy || !project) return <><button className="back-link" onClick={onBack}>← 返回项目列表</button><LoadingBlock /></>;
  const owner = project.ownerId === user.id;
  const toggleRecruitment = () => api.setPaused(project.id, !project.recruitmentPaused).then(() => { onFeedback({ tone: 'success', text: project.recruitmentPaused ? '招募已恢复。' : '招募已暂停，已有申请仍可审核。' }); load(); refresh(); }).catch((error) => onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '状态更新失败' }));
  return <section><button className="back-link" onClick={onBack}>← 返回项目列表</button><div className="detail-head"><div><div className="eyebrow">PROJECT / 项目详情</div><div className="detail-title-row"><h1 className="page-title small">{project.title}</h1><span className={project.recruitmentPaused ? 'status paused' : project.allRolesFull ? 'status full' : 'status open'}>{project.recruitmentPaused ? '暂停招募' : project.allRolesFull ? '招募已满' : '正在招募'}</span></div><p className="lead wide">{project.goal}</p></div>{owner && <button className="outline-button" onClick={toggleRecruitment}>{project.recruitmentPaused ? '恢复招募' : '暂停招募'} <span>↗</span></button>}</div><div className="detail-layout"><div className="detail-main"><InfoPanel title="项目脉络"><div className="story-grid"><Story label="当前进展" text={project.progress} /><Story label="预期成果" text={project.expectedOutcome} /></div></InfoPanel><InfoPanel title="招募角色"><div className="role-detail-list">{project.roles.map((role) => <div className="role-detail" key={role.id}><div><strong>{role.name}</strong><span>{role.skills.join(' · ')}</span></div><div className="capacity"><b>{role.remaining}</b> / {role.capacity}<small>剩余名额</small></div></div>)}</div></InfoPanel><InfoPanel title={`项目成员 · ${project.memberCount}`}><div className="member-row">{project.members.map((member) => <div className="member" key={member.id}><span className="member-avatar">{member.user.nickname.slice(0, 1)}</span><span>{member.user.nickname}<small>{member.isOwner ? '发起人' : project.roles.find((role) => role.id === member.roleId)?.name ?? '成员'}</small></span></div>)}</div></InfoPanel></div><aside className="detail-aside"><div className="owner-card"><div className="eyebrow">PROJECT LEAD</div><div className="owner-avatar">{project.owner.nickname.slice(0, 1)}</div><h3>{project.owner.nickname}</h3><p>{project.ownerProfile.bio}</p><div className="tag-list">{project.ownerProfile.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div>{owner ? <ReviewPanel project={project} onFeedback={onFeedback} refresh={load} /> : <ApplicationForm project={project} onFeedback={onFeedback} onDone={load} />}</aside></div></section>;
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) { return <div className="info-panel"><div className="panel-heading"><h2>{title}</h2><span>✳</span></div>{children}</div>; }
function Story({ label, text }: { label: string; text: string }) { return <div className="story"><span>{label}</span><p>{text}</p></div>; }

function ApplicationForm({ project, onFeedback, onDone }: { project: ProjectDetail; onFeedback: (feedback: Feedback) => void; onDone: () => void }) {
  const [roleId, setRoleId] = useState(project.roles.find((role) => role.remaining)?.id ?? ''); const [reason, setReason] = useState(''); const [contribution, setContribution] = useState(''); const [busy, setBusy] = useState(false); const disabled = project.recruitmentPaused || project.allRolesFull || !project.roles.some((role) => role.remaining);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await api.createApplication(project.id, { roleId, reason, contribution }); onFeedback({ tone: 'success', text: '申请已提交，等待发起人审核。' }); setReason(''); setContribution(''); onDone(); } catch (error) { onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '申请提交失败' }); } finally { setBusy(false); } };
  return <div className="apply-card"><div className="eyebrow">JOIN THIS PROJECT</div><h2>成为下一位<br /><em>队友</em></h2>{disabled ? <div className="blocked-note">{project.recruitmentPaused ? '项目已暂停招募，暂不接受新申请。' : '当前没有可申请的角色。'}</div> : <form onSubmit={submit}><label>申请角色<select value={roleId} onChange={(event) => setRoleId(event.target.value)}>{project.roles.filter((role) => role.remaining).map((role) => <option key={role.id} value={role.id}>{role.name} · 余 {role.remaining} 席</option>)}</select></label><label>为什么想加入？<textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说说你的相关经历和动机…" /></label><label>你可以承担什么？<textarea required value={contribution} onChange={(event) => setContribution(event.target.value)} placeholder="具体描述你愿意负责的内容…" /></label><button className="primary" disabled={busy}>{busy ? '提交中…' : '提交申请'} <span>↗</span></button></form>}</div>;
}

function ReviewPanel({ project, onFeedback, refresh }: { project: ProjectDetail; onFeedback: (feedback: Feedback) => void; refresh: () => void }) {
  const pending = project.applications.filter((application) => application.status === 'pending');
  const decide = async (application: Application, action: 'approve' | 'reject') => { try { if (action === 'approve') await api.approve(application.id); else { const reason = window.prompt('请输入拒绝原因：', '当前角色匹配度暂不合适'); if (!reason) return; await api.reject(application.id, reason); } onFeedback({ tone: 'success', text: action === 'approve' ? '申请已通过，成员和名额已同步更新。' : '申请已拒绝，申请人可以查看原因并重新申请。' }); refresh(); } catch (error) { onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '审核失败' }); } };
  return <div className="review-card"><div className="panel-heading"><h2>申请审核</h2><span>{pending.length} 待处理</span></div>{project.applications.length === 0 ? <EmptyState title="还没有申请" text="新的申请会出现在这里。" /> : <div className="application-list">{project.applications.map((application) => <div className="application-item" key={application.id}><div className="application-meta"><span className="member-avatar">{application.profileSnapshot.nickname.slice(0, 1)}</span><div><strong>{application.profileSnapshot.nickname}</strong><small>{project.roles.find((role) => role.id === application.roleId)?.name} · {statusText[application.status]}</small></div></div><p>{application.reason}</p><small className="contribution">可承担：{application.contribution}</small>{application.status === 'pending' ? <div className="review-actions"><button className="approve-button" onClick={() => decide(application, 'approve')}>接受</button><button className="reject-button" onClick={() => decide(application, 'reject')}>拒绝</button></div> : application.rejectionReason ? <div className="rejection-reason">原因：{application.rejectionReason}</div> : null}</div>)}</div>}</div>;
}

function MyApplications({ onFeedback, refreshKey }: { onFeedback: (feedback: Feedback) => void; refreshKey: number }) {
  const [applications, setApplications] = useState<Application[]>([]); const [busy, setBusy] = useState(true);
  useEffect(() => { setBusy(true); api.applications().then(({ applications: next }) => setApplications(next)).catch((error) => onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '申请加载失败' })).finally(() => setBusy(false)); }, [refreshKey]);
  const withdraw = async (application: Application) => { try { await api.withdraw(application.id); onFeedback({ tone: 'success', text: '申请已撤回，之后仍可重新申请。' }); setApplications((items) => items.map((item) => item.id === application.id ? { ...item, status: 'withdrawn' } : item)); } catch (error) { onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '撤回失败' }); } };
  return <section><div className="eyebrow">YOUR APPLICATIONS / 我的申请</div><h1 className="page-title">每一次<br /><em>尝试加入</em></h1><p className="lead">查看申请进度和发起人的反馈。</p>{busy ? <LoadingBlock /> : applications.length === 0 ? <EmptyState title="还没有申请记录" text="去发现项目，提交你的第一份申请吧。" /> : <div className="application-history">{applications.map((application) => <div className="history-row" key={application.id}><div><span className={`status-badge ${application.status}`}>{statusText[application.status]}</span><h3>项目申请</h3><p>{application.reason}</p>{application.rejectionReason && <small>拒绝原因：{application.rejectionReason}</small>}</div><div className="history-side"><span>{new Date(application.createdAt).toLocaleDateString('zh-CN')}</span>{application.status === 'pending' && <button className="text-button" onClick={() => withdraw(application)}>撤回申请</button>}</div></div>)}</div>}<p className="section-footnote">待审核申请不会占用角色名额</p></section>;
}

function CreatedProjects({ user, onSelect, onFeedback, refreshKey, onRefresh }: { user: User; onSelect: (id: string) => void; onFeedback: (feedback: Feedback) => void; refreshKey: number; onRefresh: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => { api.projects({}).then(({ projects: next }) => setProjects(next.filter((project) => project.ownerId === user.id))).catch((error) => onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '项目加载失败' })); }, [refreshKey]);
  return <section><div className="eyebrow">YOUR PROJECTS / 我发起的</div><div className="section-title-row"><h1 className="page-title">让项目<br /><em>继续发生</em></h1><button className="primary compact" onClick={() => window.dispatchEvent(new CustomEvent('new-project'))}>+ 发布项目</button></div><p className="lead">管理招募状态，审核申请，并保持团队信息透明。</p><div className="project-grid">{projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onClick={() => onSelect(project.id)} />)}</div><CreateProjectForm onFeedback={onFeedback} onDone={onRefresh} /></section>;
}

function CreateProjectForm({ onFeedback, onDone }: { onFeedback: (feedback: Feedback) => void; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(''); const [goal, setGoal] = useState(''); const [progress, setProgress] = useState(''); const [outcome, setOutcome] = useState(''); const [role, setRole] = useState(''); const [skills, setSkills] = useState(''); const [capacity, setCapacity] = useState(1);
  useEffect(() => { const openForm = () => setOpen(true); window.addEventListener('new-project', openForm); return () => window.removeEventListener('new-project', openForm); }, []);
  if (!open) return null;
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await api.createProject({ title, goal, progress, expectedOutcome: outcome, roles: [{ name: role, skills: skills.split(',').map((skill) => skill.trim()).filter(Boolean), capacity }] }); onFeedback({ tone: 'success', text: '项目已发布，可以开始接收申请。' }); setOpen(false); onDone(); } catch (error) { onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '项目发布失败' }); } };
  return <div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><button type="button" className="close-button" onClick={() => setOpen(false)}>×</button><div className="eyebrow">NEW PROJECT / 发布项目</div><h2>让一个想法<br /><em>找到队友</em></h2><div className="form-grid"><label>项目标题<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>招募角色<input required value={role} onChange={(event) => setRole(event.target.value)} /></label><label className="wide-field">项目目标<textarea required value={goal} onChange={(event) => setGoal(event.target.value)} /></label><label>当前进展<textarea required value={progress} onChange={(event) => setProgress(event.target.value)} /></label><label>预期成果<textarea required value={outcome} onChange={(event) => setOutcome(event.target.value)} /></label><label>技能要求<input required value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="React, TypeScript" /></label><label>招募人数<input type="number" min="1" max="99" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label></div><button className="primary">发布项目 <span>↗</span></button></form></div>;
}

function ProfilePage({ user, onUserChange, onFeedback }: { user: User; onUserChange: (user: User) => void; onFeedback: (feedback: Feedback) => void }) {
  const [profile, setProfile] = useState(user); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { const result = await api.updateProfile({ nickname: profile.nickname, bio: profile.bio, skills: profile.skills, weeklyHours: profile.weeklyHours }); onUserChange(result.profile); onFeedback({ tone: 'success', text: '个人资料已更新。新申请会使用最新资料快照。' }); } catch (error) { onFeedback({ tone: 'error', text: error instanceof Error ? error.message : '资料更新失败' }); } finally { setBusy(false); } };
  return <section><div className="eyebrow">YOUR PROFILE / 个人资料</div><h1 className="page-title">让别人知道<br /><em>你能带来什么</em></h1><form className="profile-form" onSubmit={submit}><label>昵称<input required value={profile.nickname} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} /></label><label>每周可投入小时<input type="number" min="0" max="168" value={profile.weeklyHours} onChange={(event) => setProfile({ ...profile, weeklyHours: Number(event.target.value) })} /></label><label className="wide-field">个人简介<textarea value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label><label className="wide-field">技能标签<textarea value={profile.skills.join(', ')} onChange={(event) => setProfile({ ...profile, skills: event.target.value.split(',').map((skill) => skill.trim()).filter(Boolean) })} /></label><button className="primary" disabled={busy}>{busy ? '保存中…' : '保存资料'} <span>↗</span></button></form></section>;
}

function LoadingBlock() { return <div className="loading-block"><span className="pulse-dot" />正在加载…</div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span>⌁</span><h3>{title}</h3><p>{text}</p></div>; }
