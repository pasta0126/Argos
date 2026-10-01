import asyncio


class Busy(Exception):
    """The inference slot is taken and the wait queue is full."""


class InferenceGate:
    """One inference at a time, with at most `max_queue` requests waiting.

    Lives on a single event loop, so the waiter count needs no lock.
    """

    def __init__(self, max_queue: int) -> None:
        self._sem = asyncio.Semaphore(1)
        self._max_queue = max_queue
        self._waiting = 0

    async def __aenter__(self) -> None:
        if self._sem.locked():
            if self._waiting >= self._max_queue:
                raise Busy
            self._waiting += 1
            try:
                await self._sem.acquire()
            finally:
                self._waiting -= 1
        else:
            await self._sem.acquire()

    async def __aexit__(self, *exc) -> None:
        self._sem.release()
