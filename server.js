const { MongoClient } = require('mongodb');
const io = require('socket.io')(5501, {
  cors: {
    origin: "http://127.0.0.1:5501",
    methods: ["GET", "POST"]
  }
});

const uri = 'mongodb+srv://aedrianjeaodetorresajgdt:C128Gm0tja6gff3L@cluster0.zz3ogso.mongodb.net/test';
const users = {};
const socketRooms = {}; // Object to store rooms associated with sockets

async function fetchAndDisplayMessages(room, socket, name1) {
  const client = new MongoClient(uri);

  try {
    // Connect to the MongoDB database
    await client.connect();

    // Access the database and collection
    const database = client.db('test');
    const collection = database.collection('test-message');

    // Fetch conversation messages using a stream
    const cursor = collection.find({ roomID: room });
    const stream = cursor.stream();

    stream.on('data', async (doc) => {
      const decodedConvo = Buffer.from(doc.convo.buffer, 'base64').toString('utf-8');
      const messages = decodedConvo.split('\n');
      for (const message of messages) {
        // Split the message into name and content
        const [name, content] = message.split(': ');
        // Check if both name and content are not empty
        if (name.trim() !== '' && content.trim() !== '') {
          if(name === name1){
            const name = "You"
            socket.emit('chat-message', { message: content, name: name });
          }else{
            socket.emit('chat-message', { message: content, name: name });
          }
          
        }
      }
    });

    stream.on('error', (error) => {
      console.error('Error fetching conversation messages:', error);``
    });

    stream.on('end', () => {
      // Close the MongoDB connection when done
      client.close();
    });
  } catch (error) {
    console.error('Error fetching and displaying messages:', error);
  }
}

// Socket event listeners
io.on('connection', async (socket) => {
  socket.on('new-user', async ({ name, room }) => {
    try {
      users[socket.id] = name;
      socket.join(room); // Join the room
      socketRooms[socket.id] = room; // Save the room associated with the socket

      // Check if the room already exists in the database
      const client = new MongoClient(uri);
      await client.connect();
      const database = client.db('test');
      const collection = database.collection('test-message');
      const collection1 = database.collection('test-rooms');
      const existingRoomUser = await collection1.findOne({ UserId: users[socket.id], Rooms: room });
      const existingRoom = await collection.findOne({ roomID: room });


      if (!existingRoomUser) {
        // If the room doesn't exist for the user, add it to the user's document
        await collection1.updateOne(
          // Filter: Find the user document by user ID
          { UserId: users[socket.id] },
          // Update: Add the new room to the Rooms array
          { $addToSet: { Rooms: room } }
        );
      }

      if (!existingRoom) {
        // If the room doesn't exist, create a new entry for the room in the database
        await collection.insertOne({ roomID: room, convo: Buffer.from('', 'utf-8') });
      }

      client.close();

      socket.to(room).emit('user-connected', name);

      // Fetch and display the conversation messages for the specified room
      await fetchAndDisplayMessages(room, socket, name);
    } catch (error) {
      console.error('Error processing new user:', error);
    }
  });
  
  socket.on('send-chat-message', async ({ message, room }) => {
    if (room === '') {
      socket.broadcast.emit('chat-message', { message: message, name: users[socket.id] });
    } else {
      socket.to(room).emit('chat-message', { message: message, name: users[socket.id] });
      await updateConversation(room, message,users[socket.id]);
    } 
  
    // Save the message to the text file (if needed)
  });

  async function updateConversation(room, newMessage,newName) {
    const client = new MongoClient(uri);
  
    try {
      // Connect to the MongoDB database
      await client.connect();
  
      // Access the database and collection
      const database = client.db('test');
      const collection = database.collection('test-message');
  
      // Fetch the existing conversation messages
      const existingConversation = await collection.findOne({ roomID: room });
  
      // Convert the binary data to a readable format (assuming it's stored as a Buffer)
      const decodedMessages = existingConversation.convo.toString('utf-8');
  
      // Append the new message to the existing conversation
      const updatedConversation = `${decodedMessages}\n${newName}: ${newMessage}`;
  
      // Update the conversation messages in the database
      await collection.updateOne(
        { roomID: room },
        { $set: { convo: Buffer.from(updatedConversation, 'utf-8') } }
      );
  
      console.log('Conversation updated successfully.');
    } catch (error) {
      console.error('Error updating conversation:', error);
    } finally {
      // Close the MongoDB connection
      await client.close();
    }
  }
  

  socket.on('disconnect', () => {
    const room = socketRooms[socket.id]; // Get the room associated with the socket
    if (room) {
      socket.to(room).emit('user-disconnected', users[socket.id]);
      delete socketRooms[socket.id]; // Remove the room association
    }
    delete users[socket.id];
  });
});
