# ChatGenius

ChatGenius is a modern, real-time chat application built with Next.js 14, Supabase, and TypeScript. It features a sleek UI powered by Tailwind CSS and provides a rich messaging experience similar to popular platforms like Slack or Discord.

## Features

- 💬 Real-time messaging with WebSocket support
- 🌟 Rich message interactions (reactions, replies, threads)
- 📎 File attachments with preview support
- 👥 Team-based chat organization
- 💌 Direct messaging between users
- 🔒 Secure authentication with Supabase Auth
- 🎨 Modern UI with dark mode support
- 📱 Responsive design for all devices

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: Supabase (PostgreSQL + Real-time subscriptions)
- **Styling**: Tailwind CSS, Radix UI
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **State Management**: React Hooks + Context
- **Forms**: React Hook Form + Zod

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chatgenius.git
cd chatgenius
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file in the root directory with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
chatgenius/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── teams/             # Team management
│   └── chat/              # Chat interface
├── components/            # Reusable React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and services
├── types/                 # TypeScript type definitions
└── supabase/             # Supabase configuration and migrations
```

## Key Features in Detail

### Real-time Messaging
- Instant message delivery using Supabase's real-time subscriptions
- Message status indicators (sent, delivered)
- Rich text formatting support

### File Attachments
- Support for images, PDFs, and other file types
- Image previews and gallery view
- Secure file storage with Supabase Storage

### Team Management
- Create and manage teams
- Invite users via email
- Role-based permissions (admin, member)

### Direct Messaging
- Private conversations between users
- Online status indicators
- Read receipts

### Message Interactions
- React to messages with emojis
- Create message threads
- Quote and reply to messages

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)

## Support

If you encounter any issues or have questions, please file an issue in the GitHub repository. 