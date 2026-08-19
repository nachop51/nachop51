import { Route, Switch } from 'wouter'
import AdminNav from './components/admin-nav'
import HomePage from './pages/home'
import PostPage from './pages/posts/post'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminNav />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/posts/:id">{(params: { id: string }) => <PostPage id={params.id} />}</Route>
        <Route path="*">
          <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h1>Page not found</h1>
          </main>
        </Route>
      </Switch>
    </div>
  )
}

export default App
