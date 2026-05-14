export interface User {
  id: string;
  name: string;
}

const LOCAL_USER: User = { id: 'local-user', name: 'You' };

export function currentUser(): User {
  return LOCAL_USER;
}

export function currentUserId(): string {
  return LOCAL_USER.id;
}
