import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

function PrivateRoute({
  component: Component,
  requireAdmin = false,
}: {
  component: React.ComponentType;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect to="/login" />;
  if (requireAdmin && !user.is_admin) {
    return <Redirect to="/home" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={() => <Redirect to="/login" />} />
      <Route path={"/login"} component={Login} />
      <Route path={"/home"} component={() => <PrivateRoute component={Home} />} />
      <Route
        path={"/admin"}
        component={() => <PrivateRoute component={Admin} requireAdmin />}
      />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
