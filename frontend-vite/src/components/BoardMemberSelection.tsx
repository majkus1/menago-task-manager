import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Users, UserCheck, Check } from 'lucide-react';

interface BoardMemberSelectionProps {
  teamId?: string;
  onMembersChange: (memberIds: string[], addAll: boolean) => void;
  initialMembers?: string[];
  initialAddAll?: boolean;
  embedded?: boolean; // New prop to control styling
}

export function BoardMemberSelection({ 
  teamId, 
  onMembersChange, 
  initialMembers = [], 
  initialAddAll = false,
  embedded = false
}: BoardMemberSelectionProps) {
  const [selectedMembers, setSelectedMembers] = useState<string[]>(initialMembers);
  const [addAllMembers, setAddAllMembers] = useState(initialAddAll);

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => apiClient.getTeamMembers(teamId!),
    enabled: !!teamId,
  });

  useEffect(() => {
    onMembersChange(selectedMembers, addAllMembers);
  }, [selectedMembers, addAllMembers, onMembersChange]);

  const handleMemberToggle = (memberId: string) => {
    if (addAllMembers) return; // Don't allow individual selection when "add all" is selected
    
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAddAllToggle = () => {
    setAddAllMembers(!addAllMembers);
    if (!addAllMembers) {
      setSelectedMembers([]); // Clear individual selections
    }
  };

  if (!teamId) {
    if (embedded) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Członkowie tablicy
            </label>
            <p className="text-gray-500 text-sm">
              Najpierw wybierz zespół, aby móc dodać członków do tablicy
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Członkowie tablicy
          </CardTitle>
          <CardDescription>
            Wybierz członków zespołu, którzy będą mieli dostęp do tej tablicy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">
            Najpierw wybierz zespół, aby móc dodać członków do tablicy
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    if (embedded) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Członkowie tablicy
            </label>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Członkowie tablicy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <div className="space-y-4">
      {/* Add All Members Option */}
      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-medium">Dodaj wszystkich członków zespołu</p>
            <p className="text-sm text-gray-600">
              Wszyscy członkowie zespołu będą mieli dostęp do tej tablicy
            </p>
          </div>
        </div>
        <Button
          variant={addAllMembers ? "default" : "outline"}
          onClick={handleAddAllToggle}
          className={addAllMembers ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          {addAllMembers ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Wybrane
            </>
          ) : (
            'Wybierz wszystkich'
          )}
        </Button>
      </div>

      {/* Individual Member Selection */}
      {!addAllMembers && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Wybierz konkretnych członków:</h4>
          {teamMembers.length === 0 ? (
            <p className="text-gray-500 text-sm">Brak członków zespołu do wyboru</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedMembers.includes(member.user.id)
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleMemberToggle(member.user.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedMembers.includes(member.user.id)
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedMembers.includes(member.user.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{member.user.firstName} {member.user.lastName}</p>
                      <p className="text-sm text-gray-600">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      member.role === 1 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {member.role === 1 ? 'Admin' : 'Członek'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="pt-4 border-t">
        <p className="text-sm text-gray-600">
          {addAllMembers 
            ? `Wszyscy członkowie zespołu (${teamMembers.length}) będą mieli dostęp do tablicy`
            : `${selectedMembers.length} członków zostanie dodanych do tablicy`
          }
        </p>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Członkowie tablicy
          </label>
          <p className="text-sm text-gray-600 mb-4">
            Wybierz członków zespołu, którzy będą mieli dostęp do tej tablicy
          </p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Członkowie tablicy
        </CardTitle>
        <CardDescription>
          Wybierz członków zespołu, którzy będą mieli dostęp do tej tablicy
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
