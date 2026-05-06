// Firestore chat persistence service
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Msg } from "@/components/ChatView";

export interface ChatDoc {
  id: string;
  uid: string;
  title: string;
  messages: Msg[];
  createdAt?: any;
  updatedAt?: any;
}

const chatsCol = collection(db, "chats");

export async function createChat(uid: string, title = "New chat") {
  const ref = await addDoc(chatsCol, {
    uid,
    title,
    messages: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateChat(
  chatId: string,
  data: Partial<Pick<ChatDoc, "title" | "messages">>,
) {
  await updateDoc(doc(db, "chats", chatId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChat(chatId: string) {
  await deleteDoc(doc(db, "chats", chatId));
}

export function subscribeUserChats(
  uid: string,
  cb: (chats: ChatDoc[]) => void,
  onError?: (e: Error) => void,
) {
  // Avoid composite-index requirement: filter by uid only, sort client-side.
  const q = query(chatsCol, where("uid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: ChatDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatDoc, "id">),
      }));
      list.sort((a, b) => {
        const at = a.updatedAt?.toMillis?.() ?? 0;
        const bt = b.updatedAt?.toMillis?.() ?? 0;
        return bt - at;
      });
      cb(list);
    },
    (err) => {
      console.error("subscribeUserChats", err);
      onError?.(err);
    },
  );
}
