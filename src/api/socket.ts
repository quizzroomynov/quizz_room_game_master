import { io } from "socket.io-client";

const socket = io('http://localhost:3000'); 

socket.on('connect', () => {
  console.log('Connecté au serveur WebSocket');
});

socket.on('buzzerUpdate', (data) => {
  console.log('Mise à jour buzzer reçue:', data);
  // Ici, mets à jour ton UI avec les données reçues
});

export default socket;