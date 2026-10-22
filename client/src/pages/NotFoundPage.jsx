import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button, Card } from '../components/ui/Primitives';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-10 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-apple-bgSecondary flex items-center justify-center text-apple-textSecondary">
          <Compass className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tightHeading">Page not found.</h1>
        <p className="text-sm text-apple-textSecondary">
          The clinical view or route you requested does not exist on this MediKiosk terminal.
        </p>
        <Button onClick={() => navigate('/')} className="mx-auto">
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Overview</span>
        </Button>
      </Card>
    </div>
  );
}
