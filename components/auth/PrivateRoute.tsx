import React from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../../store';

interface PrivateRouteProps {
    children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
    const { currentUser } = useStore();
    return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

export default PrivateRoute;