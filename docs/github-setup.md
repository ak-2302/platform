# GitHub App setup

1. Create a GitHub App for the platform owner.
2. Grant repository permissions only for the song repositories:
   - Contents: Read and write
   - Pull requests: Read and write
   - Checks: Read
   - Metadata: Read
3. Install the App on `song-demo` only during the MVP.
4. Set the App ID, installation ID, private key, and webhook secret in the server environment using `.env.example` as the template.
5. Configure the webhook URL as `/api/webhooks/github` and send the `x-hub-signature-256` header.

The browser only calls the platform API. It never receives the App private key, installation token, or webhook secret.
