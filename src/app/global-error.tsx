"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 text-center font-sans">
        <h1 className="text-lg font-semibold mb-2">Erro no sistema</h1>
        <p className="text-gray-600 mb-6 text-sm">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 bg-blue-900 text-white rounded-md text-sm"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
