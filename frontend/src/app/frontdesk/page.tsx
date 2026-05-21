import { redirect } from 'next/navigation';

export default function FrontdeskRoot() {
  redirect('/frontdesk/requests');
}
