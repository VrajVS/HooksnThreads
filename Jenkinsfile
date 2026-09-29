// Builds and deploys the site on the server Jenkins runs on (see DEPLOY.md).
// Secrets live in /opt/hooksnthreads/hooksnthreads.env on the server, never in git.
pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 30, unit: 'MINUTES')
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    environment {
        COMPOSE = 'docker compose --env-file /opt/hooksnthreads/hooksnthreads.env -p hooksnthreads'
    }

    stages {
        stage('Build') {
            steps {
                sh '$COMPOSE build --pull'
            }
        }

        stage('Deploy') {
            steps {
                // The api container applies pending database migrations as it starts.
                sh '$COMPOSE up -d --remove-orphans'
            }
        }

        stage('Smoke') {
            steps {
                // Through nginx -> api -> database, from inside the web container.
                sh '''
                    for i in $(seq 1 36); do
                        if $COMPOSE exec -T web wget -qO- http://127.0.0.1/api/health; then
                            echo; echo "Site is healthy"; exit 0
                        fi
                        sleep 5
                    done
                    echo "Site did not become healthy"; $COMPOSE logs --tail=80 api web; exit 1
                '''
            }
        }
    }

    post {
        always {
            sh '$COMPOSE ps'
        }
        success {
            // Old image layers pile up with every deploy on a small disk.
            sh 'docker image prune -f'
        }
    }
}
