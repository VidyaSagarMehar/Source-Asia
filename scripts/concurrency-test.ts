type RequestResult = {
  status: number;
  body: unknown;
};

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const CONCURRENT_REQUESTS = Number(process.env.CONCURRENT_REQUESTS ?? 20);

const run = async () => {
  const userId = `concurrency-user-${Date.now()}`;
  const payload = { source: "concurrency-test" };

  const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, index) =>
    fetch(`${API_BASE_URL}/api/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, payload: { ...payload, index } })
    }).then(async (res): Promise<RequestResult> => {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      return { status: res.status, body };
    })
  );

  const results = await Promise.all(requests);
  const accepted = results.filter((r) => r.status === 200).length;
  const rejected = results.filter((r) => r.status === 429).length;

  console.log("Concurrent test finished");
  console.log(`User ID: ${userId}`);
  console.log(`Accepted (should be 5): ${accepted}`);
  console.log(`Rejected (should be ${CONCURRENT_REQUESTS - 5}): ${rejected}`);
  console.log("Sample results:", results.slice(0, 5));
};

run().catch((error) => {
  console.error("Concurrency test failed", error);
  process.exit(1);
});
