import pandas as pd
import matplotlib.pyplot as plt

# Lê o arquivo CSV (substitua 'seu_arquivo.csv' pelo nome do seu arquivo)
df = pd.read_csv('debug.E-n23-k3.evrp.csv')

# Filtra as linhas onde 'run' é igual a 2
df_filtered = df[df['run'].astype(int) == 1]

# Plota o gráfico
plt.plot(df_filtered['seconds'], df_filtered['current_best'], marker='o', linestyle='-', label='Run')
plt.xlabel('Seconds')
plt.ylabel('Best Value')
plt.title('Gráfico de Linhas para Run = 2')
plt.legend()
plt.grid(True)
plt.show()
