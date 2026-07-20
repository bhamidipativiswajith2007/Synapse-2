const VITE_API_URL = import.meta.env.VITE_API_URL; // Points to http://localhost:3000/api

/**
 * @param {string} language - programming language
 * @param {string} code - source code to be executed
 * @returns {Promise<{success:boolean, output?:string, error?: string}>}
 */
export async function executeCode(language, code) {
  try {
    const response = await fetch(`${VITE_API_URL}/code/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language,
        code,
        stdin: "",
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const resData = await response.json();
    if (!resData.success) {
      return {
        success: false,
        error: resData.message || "Failed to execute code",
      };
    }

    const { stdout, stderr } = resData.data;

    if (stderr) {
      return {
        success: false,
        output: stdout,
        error: stderr,
      };
    }

    return {
      success: true,
      output: stdout || "No output",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute code: ${error.message}`,
    };
  }
}
