package com.samira.estetica;

import android.os.Bundle;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        criarCanalNotificacao();
    }

    private void criarCanalNotificacao() {
        NotificationChannelCompat channel = new NotificationChannelCompat
                .Builder("lembretes", NotificationManagerCompat.IMPORTANCE_HIGH)
                .setName("Lembretes")
                .setDescription("Notificações de lembretes da Samira Estética")
                .build();

        NotificationManagerCompat manager = NotificationManagerCompat.from(this);
        manager.createNotificationChannel(channel);
    }
}