import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player } from '../types';
import { supabase } from '../lib/supabase';

interface GameData {
  id: string;
  court_number: number;
  team_a: Player[];
  team_b: Player[];
}

interface TeamEditorModalProps {
  games: GameData[];
  onClose: () => void;
  onSave: () => void;
}

interface DraggablePlayerProps {
  player: Player;
  gameId: string;
  team: 'A' | 'B';
}

function DraggablePlayer({ player, gameId, team }: DraggablePlayerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${gameId}-${team}-${player.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-rally-dark/50 rounded-lg p-3 cursor-move hover:bg-rally-dark/70 transition-all border border-white/5 hover:border-rally-coral/30"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-100 truncate">{player.name}</div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {player.position && (
              <span className="px-1.5 py-0.5 bg-rally-coral/20 text-rally-coral rounded">
                {player.position}
              </span>
            )}
            <span>Rating: {player.rating}</span>
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
    </div>
  );
}

export default function TeamEditorModal({ games: initialGames, onClose, onSave }: TeamEditorModalProps) {
  const [games, setGames] = useState<GameData[]>(initialGames);
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const [gameId, team, playerId] = (event.active.id as string).split('-');
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const teamPlayers = team === 'A' ? game.team_a : game.team_b;
    const player = teamPlayers.find(p => p.id === playerId);
    if (player) {
      setActivePlayer(player);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActivePlayer(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const [sourceGameId, sourceTeam, playerId] = (active.id as string).split('-');
    const [targetGameId, targetTeam] = (over.id as string).split('-');

    // Don't allow moving to the same position
    if (sourceGameId === targetGameId && sourceTeam === targetTeam) return;

    setGames(prevGames => {
      const newGames = [...prevGames];
      const sourceGame = newGames.find(g => g.id === sourceGameId);
      const targetGame = newGames.find(g => g.id === targetGameId);

      if (!sourceGame || !targetGame) return prevGames;

      // Find and remove player from source team
      const sourceTeamKey = sourceTeam === 'A' ? 'team_a' : 'team_b';
      const sourceTeamPlayers = sourceGame[sourceTeamKey];
      const playerIndex = sourceTeamPlayers.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return prevGames;

      const [movedPlayer] = sourceTeamPlayers.splice(playerIndex, 1);

      // Add player to target team
      const targetTeamKey = targetTeam === 'A' ? 'team_a' : 'team_b';
      targetGame[targetTeamKey].push(movedPlayer);

      return newGames;
    });
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (!over) return;

    // Allow dropping on team containers
    const overId = over.id as string;
    if (overId.endsWith('-drop-zone')) {
      return;
    }
  };

  const calculateTeamRating = (players: Player[]) => {
    if (players.length === 0) return 0;
    return Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing game_players entries for these games
      const gameIds = games.map(g => g.id);
      await supabase
        .from('game_players')
        .delete()
        .in('game_id', gameIds);

      // Insert new game_players entries
      const gamePlayersToInsert = games.flatMap(game => [
        ...game.team_a.map(player => ({
          game_id: game.id,
          player_id: player.id,
          team: 'A' as const,
        })),
        ...game.team_b.map(player => ({
          game_id: game.id,
          player_id: player.id,
          team: 'B' as const,
        })),
      ]);

      const { error } = await supabase
        .from('game_players')
        .insert(gamePlayersToInsert);

      if (error) throw error;

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving teams:', error);
      alert('Failed to save teams. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card-glass max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-rally-dark/95 backdrop-blur-sm p-6 border-b border-white/10 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-100">Edit Teams</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            Drag and drop players to rearrange teams. Players can be moved between teams and courts.
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="p-6 space-y-6">
            {games.map(game => {
              const teamARating = calculateTeamRating(game.team_a);
              const teamBRating = calculateTeamRating(game.team_b);
              const ratingDiff = Math.abs(teamARating - teamBRating);

              return (
                <div key={game.id} className="card-glass p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-100">
                      Court {game.court_number}
                    </h3>
                    <div className="text-sm">
                      <span className={`font-medium ${ratingDiff > 50 ? 'text-red-400' : ratingDiff > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                        Rating Diff: {ratingDiff}
                      </span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Team A */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-rally-coral">Team A</h4>
                        <div className="text-sm text-gray-400">
                          Avg: <span className="text-gray-200 font-medium">{teamARating}</span>
                          <span className="text-gray-500 ml-2">({game.team_a.length} players)</span>
                        </div>
                      </div>
                      <SortableContext items={game.team_a.map(p => `${game.id}-A-${p.id}`)}>
                        <div
                          id={`${game.id}-A-drop-zone`}
                          className="space-y-2 min-h-[100px] p-2 rounded-lg border-2 border-dashed border-white/10 bg-rally-darker/30"
                        >
                          {game.team_a.map(player => (
                            <DraggablePlayer
                              key={player.id}
                              player={player}
                              gameId={game.id}
                              team="A"
                            />
                          ))}
                          {game.team_a.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                              Drop players here
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </div>

                    {/* Team B */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-rally-accent">Team B</h4>
                        <div className="text-sm text-gray-400">
                          Avg: <span className="text-gray-200 font-medium">{teamBRating}</span>
                          <span className="text-gray-500 ml-2">({game.team_b.length} players)</span>
                        </div>
                      </div>
                      <SortableContext items={game.team_b.map(p => `${game.id}-B-${p.id}`)}>
                        <div
                          id={`${game.id}-B-drop-zone`}
                          className="space-y-2 min-h-[100px] p-2 rounded-lg border-2 border-dashed border-white/10 bg-rally-darker/30"
                        >
                          {game.team_b.map(player => (
                            <DraggablePlayer
                              key={player.id}
                              player={player}
                              gameId={game.id}
                              team="B"
                            />
                          ))}
                          {game.team_b.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                              Drop players here
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activePlayer && (
              <div className="bg-rally-dark rounded-lg p-3 shadow-2xl border border-rally-coral/50">
                <div className="font-medium text-gray-100">{activePlayer.name}</div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {activePlayer.position && (
                    <span className="px-1.5 py-0.5 bg-rally-coral/20 text-rally-coral rounded">
                      {activePlayer.position}
                    </span>
                  )}
                  <span>Rating: {activePlayer.rating}</span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <div className="sticky bottom-0 bg-rally-dark/95 backdrop-blur-sm p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1"
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Teams'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
