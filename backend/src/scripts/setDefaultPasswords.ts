async function setDefaultPasswords() {
  throw new Error('setDefaultPasswords is disabled for security. Use targeted reset flows with strong generated passwords.');
}

setDefaultPasswords().then(() => process.exit(0)).catch(console.error);
