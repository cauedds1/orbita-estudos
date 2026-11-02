import {redirect} from 'next/navigation';
import {getUser,signupAllowed} from '../../lib/auth';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export default async function Login(){if(await getUser())redirect('/');return <LoginForm signup={signupAllowed()}/>}
