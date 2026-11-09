# Phase 2: background push reminders (not deployed in the MVP)

The current MVP sends browser notifications only while the website is open and the user has granted notification permission.

For reminders while the browser is closed, extend the project with:

1. Firebase Cloud Messaging (Web Push) and a service worker.
2. Store each user's FCM registration token under `users/{uid}/tokens/{tokenId}`.
3. Add a scheduled Cloud Function (`onSchedule`) in region `asia-northeast3` to query due reminders.
4. Send push notifications through Firebase Admin SDK and mark each reminder as sent to prevent duplicates.
5. Secure the function and token data; never expose server credentials in the browser.

Scheduled Cloud Functions use Cloud Scheduler and require the applicable billing configuration. Check the current Firebase and Google Cloud pricing before enabling this phase.
