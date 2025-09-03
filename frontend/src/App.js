import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

// Define the URL for our backend server
const API_URL = 'http://localhost:8000';

function App() {
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to handle file selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setError(''); // Clear any previous errors
    console.log('File selected:', selectedFile?.name);
  };

  // Function to test backend connection
  const testConnection = async () => {
    try {
      const response = await axios.get(`${API_URL}/health`);
      console.log('Backend connection successful:', response.data);
      return true;
    } catch (error) {
      console.error('Backend connection failed:', error);
      setError('Cannot connect to backend server. Make sure it\'s running on port 8000.');
      return false;
    }
  };

  // Function to handle file upload
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file.');
      return;
    }

    // No connection test needed - will catch errors during upload

    setIsLoading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Uploading file:', file.name);
      
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      });
      
      console.log('Upload response:', response.data);
      
      setSessionId(response.data.session_id);
      setMessages([{ 
        sender: 'bot', 
        text: 'File uploaded successfully! How can I help you analyze this data?' 
      }]);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      
      if (error.response) {
        // Server responded with error status
        setError(`Upload failed: ${error.response.data.detail || error.response.statusText}`);
      } else if (error.request) {
        // Request was made but no response received
        setError('No response from server. Make sure the backend is running.');
      } else {
        // Something else happened
        setError(`Upload error: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle sending a chat message
  const handleSendMessage = async () => {
    if (!currentMessage.trim()) {
      setError('Please type a message.');
      return;
    }
    
    if (!sessionId) {
      setError('Please upload a file first.');
      return;
    }

    const newMessages = [...messages, { sender: 'user', text: currentMessage }];
    setMessages(newMessages);
    setCurrentMessage('');
    setIsLoading(true);
    setError('');

    try {
      // Use URLSearchParams instead of FormData for better compatibility
      const data = new URLSearchParams();
      data.append('session_id', sessionId);
      data.append('prompt', currentMessage);

      console.log('Sending chat request:', {
        session_id: sessionId,
        prompt: currentMessage
      });

      const response = await axios.post(`${API_URL}/chat`, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 60000, // 60 second timeout for chat
      });

      setMessages([...newMessages, { sender: 'bot', text: response.data.response }]);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      let errorMessage = 'Sorry, I encountered an error.';
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        
        if (error.response.data?.detail) {
          if (Array.isArray(error.response.data.detail)) {
            // Handle FastAPI validation errors
            const details = error.response.data.detail.map(err => 
              `${err.loc?.join('.')}: ${err.msg}`
            ).join(', ');
            errorMessage = `Validation Error: ${details}`;
          } else {
            errorMessage = `Error: ${error.response.data.detail}`;
          }
        } else if (typeof error.response.data === 'string') {
          errorMessage = `Error: ${error.response.data}`;
        } else {
          errorMessage = `Server error (${error.response.status}): ${error.response.statusText}`;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Please try again.';
      } else {
        errorMessage = `Request error: ${error.message}`;
      }
      
      setMessages([...newMessages, { sender: 'bot', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Data Analyst Agent 🤖</h1>
      </header>
      <main className="App-main">
        {error && (
          <div className="error-message" style={{
            background: '#ffebee', 
            color: '#c62828', 
            padding: '10px', 
            margin: '10px 0', 
            borderRadius: '4px',
            border: '1px solid #ef5350'
          }}>
            {error}
          </div>
        )}
        
        {!sessionId ? (
          <div className="upload-container">
            <h2>Upload a CSV File to Begin</h2>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              disabled={isLoading}
            />
            {file && (
              <p>Selected file: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
            )}
            <button onClick={handleUpload} disabled={isLoading || !file}>
              {isLoading ? 'Uploading...' : 'Upload and Start'}
            </button>
          </div>
        ) : (
          <div className="chat-container">
            <div className="session-info">
              <small>Session: {sessionId.substring(0, 8)}...</small>
            </div>
            <div className="message-list">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  <p>{msg.text}</p>
                </div>
              ))}
              {isLoading && <div className="message bot"><p><i>Thinking...</i></p></div>}
            </div>
            <div className="message-input">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                placeholder="Ask something about your data..."
                disabled={isLoading}
              />
              <button onClick={handleSendMessage} disabled={isLoading || !currentMessage.trim()}>
                Send
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;