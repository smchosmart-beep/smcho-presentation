-- Allow users to view their own roles
CREATE POLICY "Users can view own roles"
ON user_roles FOR SELECT
USING (user_id = auth.uid());

-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles"
ON user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only service role can insert/update/delete roles (for security)
CREATE POLICY "Service role can manage roles"
ON user_roles FOR ALL
USING (auth.jwt()->>'role' = 'service_role');