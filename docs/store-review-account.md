# Account for the app store reviewers

Apple and Google test the app before it goes on sale. They cannot use "Sign in with Google/Apple" with an
identity of their own that we know, and they will not make a real account, so both stores have a form field
for a **ready username and password**. This is how the app provides one safely.

## What it is

One ordinary member that the server keeps alive while a setting says so. It signs in the normal way (the email
and password screen of the app, `POST /api/v1/auth/login`). It can do what any member can do: save songs, write
a comment, report a comment, block a person, upload a recording, delete the account. It is **never an admin**.

## Rules the code keeps (`apps/api/app/services/store_reviewer.py`, tests in `apps/api/tests/test_store_reviewer.py`)

* **Off by default.** Nothing exists until `STORE_REVIEWER_ENABLED=true` is set on the running API.
* **No credential in the repository.** The email and the password come from the environment
  (`STORE_REVIEWER_EMAIL`, `STORE_REVIEWER_PASSWORD`, at least 12 characters). The database holds only a
  bcrypt hash.
* **Never takes over a real account.** If the email already belongs to a real member, or is one of the owner
  or admin addresses (`DEFAULT_ADMIN_EMAILS`, `PROTECTED_ADMIN_EMAILS`), the account is not made and the log says why.
* **Fails closed.** A wrong setting (short password, bad email) removes the account instead of leaving a weak one.
* **Switch off = gone.** With the flag off, the next start of the API deletes the account and its password.
* **Self-healing while on.** Every start resets the password to the current setting and restores the account if
  a reviewer deleted it during testing (Apple tests "delete account", and then the next reviewer still gets in).
* While it is on, the log has a warning line at every start: `store reviewer account is ON`.

The setting is read when the API starts, so changing it means a new revision or restart of the container
(on Azure Container Apps changing an environment value does that on its own).

## What Dada does

1. Choose a mailbox that is yours but not an owner address, for example `app-review@<your domain>` (it does
   not need to receive mail: nobody resets this password by email; if it does exist, keep it empty).
2. Make a password of 16 or more random characters in a password manager.
3. Put three values on the **running API** (Azure Container App; the password as a *secret*, never in the
   repository, never in chat): `STORE_REVIEWER_ENABLED=true`, `STORE_REVIEWER_EMAIL=...`,
   `STORE_REVIEWER_PASSWORD=secretref:...`.
4. Check: sign in with it in a build of the app.
5. Paste the email and password into **App Store Connect** (App Review Information, "Sign-in required") and
   **Play Console** (App content, "App access", instructions with the login). Add one line for the reviewers,
   for example: "Open Account, choose Email, sign in. The app also works without signing in."
6. After both stores approved: set `STORE_REVIEWER_ENABLED=false` (or remove the three values). The account is
   deleted at the next start. For each new version you submit, turn it on again with a fresh password.

## What this does not do

* It is not an "email code" bypass and there is no special login door; a leaked password gives exactly the
  rights of a normal new member and only while the flag is on. Rotate the password after each review.
* It cannot reach admin tools. Admin access comes from the owner addresses and the admin key, which this account
  does not have.
* The account is a real row in the real database while it is on (reviewers may leave comments or recordings).
  Delete test content in the admin tools after review if you do not want it shown to members.
