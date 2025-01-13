export const teams = [
  { id: 1, name: 'Acme1 Inc', avatar: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=64&h=64&fit=crop&crop=faces' },
  { id: 2, name: 'Globex Corp', avatar: 'https://images.unsplash.com/photo-1549924231-f129b911e442?w=64&h=64&fit=crop&crop=faces' },
  { id: 3, name: 'Initech', avatar: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=64&h=64&fit=crop&crop=faces' },
];

export const teamData = {
  1: {
    channels: [
      { id: 1, name: 'general' },
      { id: 2, name: 'random' },
      { id: 3, name: 'project-x' },
    ],
    directMessages: [
      { id: 1, name: 'Alice Johnson' },
      { id: 2, name: 'Bob Smith' },
      { id: 3, name: 'Charlie Brown' },
    ],
  },
  2: {
    channels: [
      { id: 1, name: 'announcements' },
      { id: 2, name: 'marketing' },
      { id: 3, name: 'sales' },
    ],
    directMessages: [
      { id: 1, name: 'David Lee' },
      { id: 2, name: 'Emma Watson' },
      { id: 3, name: 'Frank Ocean' },
    ],
  },
  3: {
    channels: [
      { id: 1, name: 'general' },
      { id: 2, name: 'development' },
      { id: 3, name: 'design' },
    ],
    directMessages: [
      { id: 1, name: 'Grace Hopper' },
      { id: 2, name: 'Alan Turing' },
      { id: 3, name: 'Ada Lovelace' },
    ],
  },
};

export const messages = {
  channels: {
    1: [
      { id: 1, user: 'Alice Johnson', content: 'Hey team, how\'s everyone doing?', timestamp: '10:00 AM', threadId: 1, reactions: [] },
      { id: 2, user: 'Bob Smith', content: 'Doing great! Just finished the report.', timestamp: '10:05 AM', threadId: 1, reactions: [] },
      { id: 3, user: 'Charlie Brown', content: 'I\'m working on the new feature. Should be done by EOD.', timestamp: '10:10 AM', threadId: 1, reactions: [] },
      { id: 4, user: 'David Lee', content: 'Anyone up for lunch?', timestamp: '12:00 PM', threadId: 2, reactions: [] },
      { id: 5, user: 'Alice Johnson', content: 'I\'m in! How about that new pizza place?', timestamp: '12:02 PM', threadId: 2, parentId: 4, reactions: [] },
      { id: 6, user: 'Emma Watson', content: 'Sounds good! I\'ll join for lunch too.', timestamp: '12:05 PM', threadId: 2, parentId: 4, reactions: [] },
      { 
        id: 7, 
        user: 'Frank Ocean', 
        content: 'Here\'s the presentation for tomorrow\'s meeting', 
        timestamp: '2:00 PM', 
        threadId: 3, 
        file: { 
          name: 'Q2_Presentation.pptx', 
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          url: '/placeholder.svg?text=Q2_Presentation.pptx'
        },
        reactions: []
      },
      { id: 8, user: 'Grace Hopper', content: 'Thanks, Frank! I\'ll review it this afternoon.', timestamp: '2:05 PM', threadId: 3, parentId: 7, reactions: [] },
      {
        id: 9,
        user: 'Alice Johnson',
        content: 'Check out this cool image I found!',
        timestamp: '3:00 PM',
        threadId: 4,
        file: {
          name: 'cool_image.jpg',
          type: 'image/jpeg',
          url: 'https://images.unsplash.com/photo-1682686581660-3693f0c588d2?w=500&h=500&fit=crop'
        },
        reactions: []
      },
    ],
    2: [
      { id: 1, user: 'Charlie Brown', content: 'Anyone up for lunch?', timestamp: '12:00 PM', threadId: 1, reactions: [] },
      { id: 2, user: 'Alice Johnson', content: 'I\'m in!', timestamp: '12:02 PM', threadId: 1, reactions: [] },
    ],
    3: [
      { id: 1, user: 'Bob Smith', content: 'Project X update: We\'re on track for the deadline.', timestamp: '2:00 PM', threadId: 1, reactions: [] },
      { id: 2, user: 'Alice Johnson', content: 'Great news! Let me know if you need any help.', timestamp: '2:05 PM', threadId: 1, reactions: [] },
    ],
  },
  directMessages: {
    1: [
      { id: 1, user: 'You', content: 'Hi Alice, do you have a moment to chat?', timestamp: '3:00 PM', reactions: [] },
      { id: 2, user: 'Alice Johnson', content: 'Sure, what\'s up?', timestamp: '3:02 PM', reactions: [] },
    ],
    2: [
      { id: 1, user: 'Bob Smith', content: 'Hey, can you review my pull request?', timestamp: '4:00 PM', reactions: [] },
      { id: 2, user: 'You', content: 'Of course, I\'ll take a look right away.', timestamp: '4:05 PM', reactions: [] },
    ],
    3: [
      { id: 1, user: 'You', content: 'Charlie, how\'s the new feature coming along?', timestamp: '5:00 PM', reactions: [] },
      { id: 2, user: 'Charlie Brown', content: 'Almost done! Just fixing a few bugs.', timestamp: '5:05 PM', reactions: [] },
    ],
  },
};

export const currentUser = {
  id: 1,
  name: 'John Doe',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces',
  status: 'online' as const // can be 'online', 'away', 'busy', or 'offline'
};

