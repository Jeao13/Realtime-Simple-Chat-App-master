const socket = io('http://localhost:5501');
const messageContainer = document.getElementById('message-container');
const messageForm = document.getElementById('send-container');
const messageInput = document.getElementById('message-input');


const name = prompt('What is your name?');
const room = prompt('Name of the room?');


appendMessage('You joined');
appendMessage('Your room is ' + room);
socket.emit('new-user', { name: name, room: room }); // Emitting an object with name and room properties

socket.on('chat-message', data => {
  appendMessage(`${data.name}: ${data.message}`);
});

socket.on('user-connected', name => {
  appendMessage(`${name} connected`);
});

socket.on('user-disconnected', name => {
  appendMessage(`${name} disconnected`);
});

messageForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = messageInput.value;
  appendMessage(`You: ${message}`);
  // Emitting send-chat-message event with message and room parameters
  socket.emit('send-chat-message', { message: message, room: room });
  messageInput.value = '';
});




function appendMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.innerText = message;
  messageContainer.append(messageElement);
}



