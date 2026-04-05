import Chat from '@/components/chat/chat'
import { Header } from '@/components/header/header'

export default function ChatPage(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header />
      <Chat />
    </div>
  )
}
