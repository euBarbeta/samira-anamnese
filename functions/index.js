const {onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");

initializeApp();

exports.removerUsuarioAuthAoExcluirPaciente = onDocumentDeleted(
    "usuarios/{esteticistaId}/pacientes/{pacienteId}",
    async (event) => {
      const pacienteId = event.params.pacienteId;

      try {
        await getAuth().deleteUser(pacienteId);
        console.log(
            `UID ${pacienteId} deletado com sucesso.`,
        );
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          console.log(
              `Usuário ${pacienteId} não encontrado no Auth.`,
          );
        } else {
          console.error(
              "Erro ao deletar usuário:",
              error,
          );
        }
      }
    },
);
