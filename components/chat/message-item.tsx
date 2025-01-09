import React from 'react';

interface MessageItemProps {
  message: any;  // Temporarily type as any to rule out type issues
  isThreadView: boolean;
}

export const MessageItem = ({ message }: MessageItemProps) => {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'red', 
      color: 'white', 
      fontSize: '24px',
      border: '5px solid blue',
      margin: '10px'
    }}>
      <h1>TESTING CHANGES</h1>
      <div>{message.content}</div>
    </div>
  );
}; 