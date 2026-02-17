import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect
} from "@tanstack/react-router";
import App from "./App";

const rootRoute = createRootRoute({
  component: App
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  }
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/login",
  component: () => null
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: () => null
});

const entriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entries",
  component: () => null
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => null
});

const settingsGroupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/groups",
  component: () => null
});

const settingsCategoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/categories",
  component: () => null
});

const settingsUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/users",
  component: () => null
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  entriesRoute,
  settingsRoute,
  settingsGroupsRoute,
  settingsCategoriesRoute,
  settingsUsersRoute
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
