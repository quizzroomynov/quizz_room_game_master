import React, { useEffect, useState } from 'react';
import socket from '../api/socket';

interface Buzzer {
  buzzerId: string;
  userName: string;
  userId: number;
}

interface Theme {
  id: number;
  label: string;
}

interface Question {
  id: number;
  titre: string;
  label: string;
  points: string;
  timer: number;
}

const Buzzer: React.FC = () => {
  const [buzzers, setBuzzers] = useState<Buzzer[]>([]);
  const [isBuzzed, setIsBuzzed] = useState(false);
  const [lastUser, setLastUser] = useState<string | null>(null);
  const [currentGame, setCurrentGame] = useState<{ id: number; name_partie: string } | null>(null);

  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connecté WebSocket:', socket.id);
    });

    socket.on('buzzed', (data) => {
      console.log('buzzed:', data);
      setIsBuzzed(true);
      setLastUser(data.user);
    });

    socket.on('buzzerUpdate', (data: { buzzers: Buzzer[] }) => {
      console.log('Liste buzzers reçue:', data);
      setBuzzers(data.buzzers ?? []);
    });

    socket.on('disconnect', () => {
      console.log('Déconnecté WebSocket');
    });

    return () => {
      socket.off('buzzed');
      socket.off('buzzerUpdate');
    };
  }, []);

  useEffect(() => {
    if (remainingTime === null) return;

    if (remainingTime <= 0) {
      socket.emit('timer ended', {
        gameId: currentGame?.id,
        questionId: selectedQuestionId,
      });
      console.log('Timer terminé - message "timer ended" envoyé via WebSocket');
      setRemainingTime(null); // Arrête le compte à rebours
      return;
    }

    const interval = setInterval(() => {
      setRemainingTime((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingTime, currentGame, selectedQuestionId]);

  const handleBuzz = () => {
    if (buzzers.length > 0) {
      socket.emit('buzz', { user: buzzers[0].userName });
    }
  };

  const handleNewGame = async () => {
    try {
      const name_partie = `Partie ${Date.now()}`;
      const score_partie = 0;

      const res = await fetch('http://localhost:3000/buzzer/api/partie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_partie, score_partie }),
      });

      if (!res.ok) throw new Error('Erreur création partie');

      const newGame = await res.json();
      setCurrentGame(newGame);

      const themeRes = await fetch('http://localhost:3000/buzzer/api/themes');
      if (!themeRes.ok) throw new Error('Erreur récupération des thèmes');

      const themesData = await themeRes.json();
      console.log('Thèmes reçus:', themesData);

      setThemes(themesData);
    } catch (err) {
      console.error('Erreur création partie ou chargement thèmes:', err);
    }
  };

  const getSelectedQuestion = (): Question | undefined => {
    return questions.find((q) => q.id === (selectedQuestionId ?? -1));
  };

  const handleThemeSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const themeId = Number(e.target.value);
    setSelectedThemeId(themeId);
    setSelectedQuestionId(null);
    setQuestions([]);

    try {
      const res = await fetch(`http://localhost:3000/buzzer/api/themes/${themeId}/questions`);
      if (!res.ok) throw new Error('Erreur récupération questions');

      const data = await res.json();
      setQuestions(data);
    } catch (error) {
      console.error('Erreur lors du chargement des questions:', error);
    }
  };

  const handleQuestionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedQuestionId(Number(e.target.value));
  };

  const handleStartGame = () => {
    if (!currentGame || !selectedQuestionId) return;

    const selectedQuestion = getSelectedQuestion();
    if (!selectedQuestion) return;

    socket.emit('game start', {
      gameId: currentGame.id,
      questionId: selectedQuestionId,
    });

    console.log('Message "game start" envoyé via WebSocket', {
      gameId: currentGame.id,
      questionId: selectedQuestionId,
    });

    setRemainingTime(selectedQuestion.timer);
  };

  return (
    <div>
      <h2>Liste des Buzzers :</h2>
      {buzzers.length > 0 ? (
        <ul>
          {buzzers.map((buzzer) => (
            <li key={buzzer.buzzerId}>
              <strong>{buzzer.userName}</strong> (Buzzer: {buzzer.buzzerId})
            </li>
          ))}
        </ul>
      ) : (
        <p>En attente de buzzers...</p>
      )}

      <div style={{ marginTop: '2rem' }}>
        {isBuzzed && lastUser && <h2>BUZZ ! par {lastUser}</h2>}
        <button onClick={handleBuzz}>BUZZER</button>
      </div>

      {buzzers.length > 0 && !currentGame && (
        <div style={{ marginTop: '2rem' }}>
          <button onClick={handleNewGame}>🎮 Commencer une nouvelle partie</button>
        </div>
      )}

      {currentGame && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Partie en cours : {currentGame.name_partie}</h2>

          <h3>Choisir un thème :</h3>
          {themes.length > 0 ? (
            <select onChange={handleThemeSelect} value={selectedThemeId ?? ''}>
              <option value="">-- Sélectionnez un thème --</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          ) : (
            <p>Chargement des thèmes...</p>
          )}

          {selectedThemeId && (
            <>
              <h3>Choisir une question :</h3>
              {questions.length > 0 ? (
                <select onChange={handleQuestionSelect} value={selectedQuestionId ?? ''}>
                  <option value="">-- Sélectionnez une question --</option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {`${q.titre} | ${q.label} | ${q.points} points`}
                    </option>
                  ))}
                </select>
              ) : (
                <p>Aucune question disponible pour ce thème.</p>
              )}
            </>
          )}

          {selectedQuestionId && (
            <div style={{ marginTop: '1rem' }}>
              <button onClick={handleStartGame}>Lancer la partie</button>
            </div>
          )}

          {remainingTime !== null && (
            <div style={{ marginTop: '1rem' }}>
              <h2>Temps restant : {remainingTime}s</h2>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Buzzer;
