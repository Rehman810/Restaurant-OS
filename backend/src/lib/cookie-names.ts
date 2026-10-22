export function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-ros_session" : "ros_session";
}

export function csrfCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-ros_csrf" : "ros_csrf";
}
