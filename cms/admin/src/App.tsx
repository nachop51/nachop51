import './App.css'
import { Route, Switch } from 'wouter'
import HomePage from './pages/home'
import PostPage from './pages/posts/post'

function App() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />

      <Route path="/posts/:id">{(params: { id: string }) => <PostPage id={params.id} />}</Route>

      <Route path="*">Not found.</Route>
    </Switch>
  )
}

export default App
