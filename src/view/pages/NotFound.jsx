import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
    const navigate = useNavigate();

    useEffect(() => {
        const redirectTo = '/';
        navigate(redirectTo, { replace: true });
    }, [navigate]);

    return null;
}