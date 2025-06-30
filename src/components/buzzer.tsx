import React, { useEffect, useState } from 'react';
import socket from '../api/socket';

interface Buzzer {
  buzzerId: number;
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

interface BuzzerResult {
  premierBuzzerId : number;
  buzzers: { 
    buzzerId: number, 
    }[];
}

interface PartieHistorique {
  id: number;
  name_partie: string;
  score_partie: number;
  winner_name: string;
}

type UserScore = {
  user_id: string;
  user_name: string;
  total_score: number;
};



const Buzzer: React.FC = () => {
  const [buzzers, setBuzzers] = useState<Buzzer[]>([]);
  const [currentGame, setCurrentGame] = useState<{ id: number; name_partie: string } | null>(null);
  const [gameBuzzers, setGameBuzzers] = useState<Buzzer[]>([]);
  const [historiqueParties, setHistoriqueParties] = useState<PartieHistorique[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [buzzResult, setBuzzResult] = useState<BuzzerResult | null>(null);




  useEffect(() => {
    fetchHistoriqueParties();
    socket.on('connect', () => {
      console.log('Connecté WebSocket:', socket.id);
    });

    socket.on('buzzed', (data) => {
      console.log('buzzed:', data);
    });

    socket.on("buzzerUpdate", (data: { buzzers: Buzzer[] }) => {
      if (data.buzzers && data.buzzers.length > 0) {
        console.log("Liste buzzers reçue:", data.buzzers);
        setBuzzers(data.buzzers);
        setGameBuzzers(data.buzzers); 
      } else {
        console.warn("Liste buzzers vide ignorée.");
      }
    });


    socket.on('buzz result', (data: BuzzerResult) => {
      console.log('Résultat du buzz reçu:', data);
      setBuzzResult(data);
    });


    socket.on('disconnect', () => {
      console.log('Déconnecté WebSocket');
    });

    console.log("Buzzers mis à jour :", buzzers);

    return () => {
      socket.off('buzzed');
      socket.off('buzzerUpdate');
      socket.off('buzz result');
    };

  }, []);

  useEffect(() => {
    if (remainingTime === null) return;

    if (remainingTime <= 0) {
      socket.emit('timer ended', {
        gameId: currentGame?.id,
        question: selectedQuestionId,
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


  const fetchHistoriqueParties = async () => {
    try {
      const res = await fetch('http://localhost:3000/buzzer/api/parties');
      if (!res.ok) throw new Error('Erreur récupération historique parties');
      const data = await res.json();
      setHistoriqueParties(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEndGame = async () => {
    socket.emit('game end', {

    });
    window.location.reload();
  }



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

      socket.emit('game start', {
        game: name_partie,
      });

      console.log('Message "game start" envoyé via WebSocket', {
        game: name_partie,
        questionId: selectedQuestionId,
      });
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

  const handleEndPartie = async () => {
    if (!currentGame) return;

    let scores: UserScore[] = [];


    // Récupération des scores
      try {
        const response = await fetch(`http://localhost:3000/buzzer/api/users/parties/${currentGame.id}/score`);

        if (response.status === 204) {

        // Étape 4 : reset UI 
        socket.emit('partie end', {
          gameId: currentGame.id,
          questionId: selectedQuestionId,
        });
  
        setCurrentGame(null);
        setSelectedThemeId("");
        setQuestions([]);
        setSelectedQuestionId(null);
        setRemainingTime(null);
        setBuzzResult(null);

        return;
        }

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de la récupération du score');
        }

        scores = await response.json();
        console.log('Scores des utilisateurs :', scores);
          // Pour chaque score utilisateur, on envoie à l'API
        for (const user of scores) {
          try {
            const res = await fetch('http://localhost:3000/buzzer/api/parties/scores', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: user.user_id,
                partie_id: currentGame.id,
                score: user.total_score,
              }),
            });

            if (!res.ok) {
              const err = await res.json();
              console.error(`Erreur en envoyant le score de l'utilisateur ${user.user_id} :`, err);
            } else {
              const data = await res.json();
              console.log(`Score de l'utilisateur ${user.user_id} enregistré avec succès :`, data);
            }
          } catch (error) {
            console.error(`Erreur réseau pour l'utilisateur ${user.user_id} :`, error);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des scores :', error);
        return;
      }



      // 2. Récupération du vainqueur (score le plus élevé)
      const winner: UserScore = scores.reduce((max: UserScore, user: UserScore) => {
        return user.total_score > max.total_score ? user : max;
      }, scores[0]); // ici on part du premier comme valeur initiale

      const scorePartie = `${winner.user_name} a gagné avec ${winner.total_score} points`;
      console.log(scorePartie)
      console.log(winner.user_id)

      


    // 3. Mise à jour de la partie
    try {
      const response = await fetch(`http://localhost:3000/buzzer/api/parties/${currentGame.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name_partie: currentGame.name_partie,
          score_partie: winner.total_score, 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Erreur lors de la mise à jour de la partie:', error);
        return;
      }

      const updatedPartie = await response.json();
      console.log('Partie mise à jour avec succès:', updatedPartie);
    } catch (error) {
      console.error('Erreur réseau lors de la mise à jour:', error);
    }


    // 4. Mise à jour historique + reset UI
    await fetchHistoriqueParties();

    socket.emit('partie end', {
      gameId: currentGame.id
    });

    setCurrentGame(null);
    setSelectedThemeId("");
    setQuestions([]);
    setSelectedQuestionId(null);
    setRemainingTime(null);
    setBuzzResult(null);
  };



  const handleQuestionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedQuestionId(Number(e.target.value));
  };

  const handleStartGame = () => {
    if (!currentGame || !selectedQuestionId) return;

    const selectedQuestion = getSelectedQuestion();
    if (!selectedQuestion) return;

    socket.emit('question start', {
      gameId: currentGame.id,
      questionId: selectedQuestionId,
      question: selectedQuestion.label,
      timer: selectedQuestion.timer,
    });

    console.log('Message "question start" envoyé via WebSocket', {
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

      {historiqueParties.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Historique des parties jouées :</h3>
          <table border={1} cellPadding={5} cellSpacing={0} style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr>
                <th>Nom de la partie</th>
                <th>Gagnant</th>
                <th>Points gagnés</th>
              </tr>
            </thead>
            <tbody>
              {historiqueParties.map((partie) => (
                <tr key={partie.id}>
                  <td>{partie.name_partie}</td>
                  <td>{partie.winner_name}</td>
                  <td>{partie.score_partie}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}



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
              <button onClick={handleStartGame}>Lancer la question</button>
            </div>
          )}

          {remainingTime !== null && (
            <div style={{ marginTop: '1rem' }}>
              <h2>Temps restant : {remainingTime}s</h2>
            </div>
          )}

          {selectedQuestionId && remainingTime === null && buzzResult === null && (
            <div style={{ marginTop: '1rem' }}>
              <h2>En attente de buzzers...</h2>
            </div>
          )}

      {buzzResult && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Résultats des buzzers :</h3>

          {(() => {
            
            // const currentIndex = buzzResult.buzzers.findIndex(
            //   (b) => String(b.buzzerId) === String(buzzResult.premierBuzzerId)
            // );
            const gagnant = gameBuzzers.find(
              (b) => String(b.buzzerId) === String(buzzResult.premierBuzzerId)
            );

            const handleBonneReponse = async () => {
              if (!currentGame || !selectedQuestionId || !gagnant) return;

              try {
                const partieId = currentGame.id;
                const questionId = selectedQuestionId;
                const userId = gagnant.userId;

                const url = `http://localhost:3000/buzzer/api/parties/${partieId}/questions/${questionId}/user/${userId}`;

                const res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                    if (!res.ok) {
                          throw new Error(`Erreur HTTP ${res.status}`);
                        }

                        // Si tu attends une réponse JSON, tu peux la récupérer ici
                        const data = await res.json();
                        console.log('Réponse du serveur:', data);

                            const selectedQuestion = getSelectedQuestion();
                          if (!selectedQuestion) return;

                        socket.emit('result question', {
                          partieName: currentGame.name_partie,
                          question: selectedQuestion.label,
                          winner: gagnant.userName,
                        });

                        // Réinitialiser le processus
                        setSelectedThemeId("");
                        setQuestions([]);
                        setSelectedQuestionId(null);
                        setRemainingTime(null);
                        setBuzzResult(null);
                        setCurrentIndex(0);
                      } catch (error) {
                        console.error("Erreur lors de l'envoi de la bonne réponse:", error);
                      }
                    };


            const handleMauvaiseReponse = () => {
              if (!buzzResult || !buzzResult.buzzers) return;
              const nextIndex = currentIndex + 1;

              const selectedQuestion = getSelectedQuestion();
                if (!selectedQuestion) return;

              socket.emit('question result', {
                partieName: currentGame.name_partie,
                question: selectedQuestion.label,
                winner: null
              });


              if (nextIndex >= buzzResult.buzzers.length) {
                // Plus aucun joueur dans la file, on revient à la sélection du thème sans fetch
                alert("Plus aucun joueur dans la file ! Retour au choix du thème.");

                // Réinitialiser uniquement les états liés aux questions et au buzzResult
                setSelectedQuestionId(null);
                setQuestions([]);
                setBuzzResult(null);
                setSelectedThemeId("");
                setCurrentIndex(0); 
                return;
              }

              const suivant = buzzResult.buzzers[nextIndex];
              setBuzzResult({
                ...buzzResult,
                premierBuzzerId: Number(suivant.buzzerId),
              });
              setCurrentIndex(nextIndex);
          };


            return (
              <>
                <h4>Le gagnant : {gagnant ? gagnant.userName : 'Utilisateur inconnu'}</h4>
                <button onClick={handleBonneReponse} style={{ marginRight: '1rem' }}>
                  ✅ Bonne réponse
                </button>
                <button onClick={handleMauvaiseReponse}>
                  ❌ Mauvaise réponse
                </button>
              </>
            );
          })()}

          <ul style={{ marginTop: '1rem' }}>
            {buzzResult.buzzers.map((b) => {
              const user = gameBuzzers.find((bz) => bz.buzzerId === b.buzzerId);
              return (
                <li key={b.buzzerId}>
                  {user ? user.userName : 'Utilisateur inconnu'} (Buzzer : {b.buzzerId})
                </li>
              );
            })}
          </ul>
        </div>
      )}


      {/* Bouton Fin de Partie fixé en bas */}
      {currentGame && (
        <button
          onClick={handleEndPartie}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 200,
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: 1000,
          }}
        >
          Fin de partie
        </button>
      )}


          {currentGame && (
            <button
              onClick={handleEndGame}
              style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#d9534f',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                zIndex: 1000,
              }}
            >
              Fin de jeu
            </button>
          )}
            
        </div>
      )}
    </div>
  );
};

export default Buzzer;
