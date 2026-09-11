from psycopg_pool import ConnectionPool

from app.config import DATABASE_URL

pool = ConnectionPool(conninfo=DATABASE_URL, min_size=1, max_size=10, open=True)


def get_conn():
    with pool.connection() as conn:
        yield conn
