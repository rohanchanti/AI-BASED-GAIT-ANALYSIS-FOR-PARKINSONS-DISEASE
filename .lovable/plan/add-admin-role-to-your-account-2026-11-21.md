# Add admin role to your account

After approval, run only this SQL:

```sql
insert into public.user_roles (user_id, role)
values (
  (select id from auth.users where email = 'browny2006bro@gmail.com'),
  'admin'
);
```

This adds the admin role only to the specified account. No other table or policy will change. If the account is still unregistered, the insert will fail without changing any data.

Verify the role with a read-only query afterward.