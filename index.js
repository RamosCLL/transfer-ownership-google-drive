require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const app = express();
const port = 3000;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Scopes define the level of access you want
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Store credentials in memory (for demo purposes)
let tokens = null;

app.get('/', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: true,
  });
  res.send(`<a href="${authUrl}">Authorize with Google</a>`);
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code provided');

  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens;
    oauth2Client.setCredentials(tokens);
    res.send('Authentication successful! You can now call the Drive API. Try <a href="/list-files">listing your files</a>.');
  } catch (err) {
    console.error('Error retrieving access token:', err);
    res.send('Error during authentication');
  }
});

app.get('/list-files', async (req, res) => {
  if (!tokens) return res.send('Not authenticated. Go to <a href="/">authorize</a> first.');
  oauth2Client.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const response = await drive.files.list({
      pageSize: 10,
      fields: 'files(id, name, owners)',
    });

    const files = response.data.files;
    if (!files.length) {
      return res.send('No files found.');
    }

    let fileList = '<h2>Your Files:</h2><ul>';
    files.forEach((file) => {
      fileList += `<li>${file.name} (ID: ${file.id}) - Owner: ${file.owners?.[0]?.emailAddress}</li>`;
    });
    fileList += '</ul>';
    res.send(fileList);
  } catch (err) {
    console.error('The API returned an error: ' + err);
    res.send('Failed to retrieve files.');
  }
});

// ✅ Ownership transfer route
app.get('/transfer-ownership', async (req, res) => {
  if (!tokens) return res.send('Not authenticated. Go to <a href="/">authorize</a> first.');
  oauth2Client.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const fileId = '13Ppv_D0QN90nx80TOOw8zfexga_mfTShzQ0yFg6rFqY';
  const newOwner = 'nmrz.creative@gmail.com';

  try {
    // Step 1: Grant writer access to the new owner
    const permission = await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: newOwner,
      },
      fields: 'id',
    });

    const permissionId = permission.data.id;

    // Step 2: Transfer ownership
    await drive.permissions.update({
      fileId,
      permissionId,
      transferOwnership: true,
      requestBody: {
        role: 'owner',
      },
    });

    res.send(`✅ Ownership of file ${fileId} successfully transferred to ${newOwner}`);
  } catch (err) {
    console.error('❌ Ownership transfer failed:', err.message);
    res.send(`❌ Error during ownership transfer: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
