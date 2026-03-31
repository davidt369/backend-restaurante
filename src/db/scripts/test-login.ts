async function main() {
  const url =
    'https://backend-restaurante-production.up.railway.app/api/auth/login';
  const credentials = {
    nombre_usuario: 'admin',
    contrasena: 'Admin123!',
  };

  console.log(`Testing login to ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
