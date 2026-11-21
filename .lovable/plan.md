# Add admin role to your account only

After approval, run this SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'browny2006bro@gmail.com'),
  'admin'
);
```

This adds only the admin role for the account with that email. No other table or policy will change. If the account is missing or already has this role, the insert will fail without changing data.

Verify afterward that this account has the admin role.

**Not executed yet.**