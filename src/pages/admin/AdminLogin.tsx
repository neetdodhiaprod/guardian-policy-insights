import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setAdminKey } from '@/lib/adminApi';

export default function AdminLogin() {
  const [key, setKey] = useState('');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Enter the admin key to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Admin key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={() => {
              setAdminKey(key);
              navigate('/admin');
            }}
            disabled={!key.trim()}
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
